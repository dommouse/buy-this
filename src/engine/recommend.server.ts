import { AiUnavailableError as ClaudeUnavailableError, claudeSuggestGifts } from "./ai/claude-suggest.server";
import { aiRerank, AiUnavailableError as LovableUnavailableError } from "./ai/reranker.server";
import { toBuyUrl } from "./affiliates/links";
import { enrichProductImages } from "./catalog/product-images";
import {
  catalogEligible,
  emergencyGiftList,
  isAmazonPdpUrl,
  isAmazonSearchUrl,
  validateRecommendations,
} from "./catalog/product-validator";
import { engineConfig } from "./config";
import {
  activeModelVersion,
  loadProducts,
  loadSegmentInsights,
  loadStats,
  maybeTrain,
  saveRecommendations,
  upsertSuggestedProducts,
} from "./data/engine-repository";
import { extractProfileFeatures } from "./features/profile";
import { assignSlotsToAll } from "./scoring/ranker";
import { scoreProducts } from "./scoring/scorer";
import type { Recommendation, RecipientProfile, RecommendationResult, ScoredProduct } from "./types";

let aiPausedUntil = 0;

/**
 * Questionnaire → Claude gift brain → validated Amazon gifts.
 * Never returns an empty list when any budget-fitting catalog gifts exist.
 */
export async function recommend(
  profile: RecipientProfile,
  ctx: { searchId: string | null; sessionId: string | null },
): Promise<RecommendationResult> {
  if (!engineConfig.enabled) {
    return emptyResult("disabled", "scoring");
  }

  const features = extractProfileFeatures(profile);
  const version = await activeModelVersion();
  const modelVersion = `${version}+${engineConfig.featureVersion}`;
  const limit = Math.min(24, Math.max(4, engineConfig.recommendationCount));

  const [products, stats, insights] = await Promise.all([
    loadProducts(),
    loadStats(features.segment),
    loadSegmentInsights(features.segment),
  ]);
  const catalogScored = scoreProducts(features, products, stats);

  if (engineConfig.mode === "claude-suggest" && Date.now() > aiPausedUntil) {
    try {
      const suggested = await claudeSuggestGifts({
        profile,
        features,
        insights,
        sessionId: ctx.sessionId,
      });
      if (suggested?.items.length) {
        let merged = await mergeClaudeWithCatalog(suggested.items, catalogScored, limit, features, ctx.sessionId);
        merged = await ensureNonEmpty(merged, catalogScored, features, limit, ctx.sessionId);
        const withImages = enrichProductImages(merged);
        await upsertSuggestedProducts(withImages);
        return finalize(withImages, {
          recommendationId: crypto.randomUUID(),
          modelVersion,
          strategy: "claude-catalog",
          tip: suggested.tip,
          segment: features.segment,
          searchId: ctx.searchId,
          sessionId: ctx.sessionId,
          breakdowns: breakdownMap(merged, catalogScored),
        });
      }
      console.warn("engine: Claude returned no usable gifts, falling back to scoring");
    } catch (err) {
      if (err instanceof ClaudeUnavailableError) aiPausedUntil = Date.now() + 30 * 60_000;
      console.error("engine: Claude suggest failed, falling back to scoring", err);
    }
  }

  return catalogHybrid(profile, features, modelVersion, ctx, catalogScored, limit);
}

async function ensureNonEmpty(
  items: Recommendation[],
  catalogScored: ScoredProduct[],
  features: ReturnType<typeof extractProfileFeatures>,
  limit: number,
  sessionId: string | null,
): Promise<Recommendation[]> {
  if (items.length >= Math.min(4, limit)) return items.slice(0, limit);
  console.warn(`engine: only ${items.length} gifts — filling from emergency catalog`);
  const fillerDraft = emergencyGiftList(catalogScored, features, limit * 2);
  const filler = await validateRecommendations(fillerDraft, { features, sessionId });
  const seen = new Set(items.map((i) => i.product.title.toLowerCase()));
  const merged = [...items];
  for (const f of filler) {
    if (seen.has(f.product.title.toLowerCase())) continue;
    seen.add(f.product.title.toLowerCase());
    merged.push({
      ...f,
      product: { ...f.product, buyUrl: toBuyUrl(f.product.buyUrl, { customId: sessionId }) },
    });
    if (merged.length >= limit) break;
  }
  // Never pad with Amazon /s? search pages — only live /dp/ASINs already in filler.
  return assignSlotsToAll(
    merged.map((m) => ({
      product: m.product,
      score: m.score,
      breakdown: { content: 0.7, budget: 1, behavior: 0, popularity: 0, ai: 0 },
      reasons: [m.reason],
    })),
  ).slice(0, limit);
}

async function mergeClaudeWithCatalog(
  claudeItems: Recommendation[],
  catalogScored: ScoredProduct[],
  limit: number,
  features: ReturnType<typeof extractProfileFeatures>,
  sessionId: string | null,
): Promise<Recommendation[]> {
  const asScored: ScoredProduct[] = claudeItems.map((item) => ({
    product: item.product,
    score: item.score,
    breakdown: { content: 0.95, budget: 1, behavior: 0, popularity: item.product.popularity / 100, ai: 1 },
    // Keep Claude's answer-tied sentence intact; formatPickReason avoids double prefixes.
    reasons: [item.reason || "Because it matches their answers from the questionnaire"],
  }));

  const seen = new Set(asScored.map((s) => normalizeTitle(s.product.title)));
  for (const s of catalogScored) {
    if (!catalogEligible(s.product, features)) continue;
    const key = normalizeTitle(s.product.title);
    if (seen.has(key)) continue;
    seen.add(key);
    asScored.push(s);
    if (asScored.length >= limit * 2) break;
  }

  const ranked = assignSlotsToAll(asScored).slice(0, Math.max(limit * 2, limit));
  const validated = await validateRecommendations(ranked, { features, sessionId });
  return assignSlotsToAll(
    validated.map((item) => ({
      product: item.product,
      score: item.score,
      breakdown: { content: 0.9, budget: 1, behavior: 0, popularity: 0, ai: 1 },
      reasons: [item.reason],
    })),
  )
    .slice(0, limit)
    .map((item) => ({
      ...item,
      product: {
        ...item.product,
        buyUrl: toBuyUrl(item.product.buyUrl, { customId: sessionId }),
      },
    }));
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function breakdownMap(items: Recommendation[], catalogScored: ScoredProduct[]) {
  const fromCatalog = new Map(catalogScored.map((s) => [s.product.id, s.breakdown]));
  return new Map(
    items.map((i) => [
      i.product.id,
      fromCatalog.get(i.product.id) ?? { content: 0.9, budget: 1, behavior: 0, popularity: 0, ai: 1 },
    ]),
  );
}

async function catalogHybrid(
  profile: RecipientProfile,
  features: ReturnType<typeof extractProfileFeatures>,
  modelVersion: string,
  ctx: { searchId: string | null; sessionId: string | null },
  scored: ScoredProduct[],
  limit: number,
): Promise<RecommendationResult> {
  let draft = assignSlotsToAll(scored).slice(0, limit * 2);
  let items = await validateRecommendations(draft, {
    features,
    sessionId: ctx.sessionId,
  });
  items = assignSlotsToAll(
    items.map((i) => ({
      product: i.product,
      score: i.score,
      breakdown: { content: 0.8, budget: 1, behavior: 0, popularity: 0, ai: 0 },
      reasons: [i.reason],
    })),
  )
    .slice(0, limit)
    .map((item) => ({
      ...item,
      product: {
        ...item.product,
        buyUrl: toBuyUrl(item.product.buyUrl, { customId: ctx.sessionId }),
      },
    }));

  let strategy: RecommendationResult["strategy"] = "scoring";
  let tip: string | null =
    "Dominique double-checked the catalog for gifts that fit their answers and budget.";

  if (engineConfig.mode === "catalog-hybrid" && Date.now() > aiPausedUntil) {
    try {
      const shortlist = scored.slice(0, engineConfig.shortlistSize);
      const ai = await aiRerank(profile, shortlist);
      if (ai) {
        const byId = new Map(shortlist.map((s) => [s.product.id, s]));
        const aiItems = ai.picks
          .map((p, i) => {
            const s = byId.get(p.productId);
            if (!s) return null;
            return {
              slot: p.slot,
              rank: i + 1,
              product: s.product,
              score: Number(s.score.toFixed(4)),
              reason: p.reason,
            } satisfies Recommendation;
          })
          .filter((x): x is Recommendation => x !== null);
        const validatedAi = await validateRecommendations(aiItems, {
          features,
          sessionId: ctx.sessionId,
        });
        if (validatedAi.length) {
          items = enrichProductImages(
            validatedAi.slice(0, limit).map((item, i) => ({
              ...item,
              rank: i + 1,
              product: { ...item.product, buyUrl: toBuyUrl(item.product.buyUrl, { customId: ctx.sessionId }) },
            })),
          );
          tip = ai.tip;
          strategy = "hybrid-ai";
        }
      }
    } catch (err) {
      if (err instanceof LovableUnavailableError) aiPausedUntil = Date.now() + 30 * 60_000;
      console.error("engine: AI re-rank failed, using scoring only", err);
    }
  }

  items = await ensureNonEmpty(items, scored, features, limit, ctx.sessionId);
  items = enrichProductImages(items);
  const breakdowns = new Map(scored.map((s) => [s.product.id, s.breakdown]));
  return finalize(items, {
    recommendationId: crypto.randomUUID(),
    modelVersion,
    strategy,
    tip,
    segment: features.segment,
    searchId: ctx.searchId,
    sessionId: ctx.sessionId,
    breakdowns,
  });
}

async function finalize(
  items: Recommendation[],
  meta: {
    recommendationId: string;
    modelVersion: string;
    strategy: RecommendationResult["strategy"];
    tip: string | null;
    segment: string;
    searchId: string | null;
    sessionId: string | null;
    breakdowns: Map<string, object>;
  },
): Promise<RecommendationResult> {
  await Promise.all([
    saveRecommendations({
      id: meta.recommendationId,
      segment: meta.segment,
      searchId: meta.searchId,
      sessionId: meta.sessionId,
      modelVersion: meta.modelVersion,
      strategy: meta.strategy,
      items: items.map((i) => ({
        productId: i.product.id,
        slot: i.slot,
        rank: i.rank,
        score: i.score,
        reason: i.reason,
        breakdown: meta.breakdowns.get(i.product.id) ?? {},
      })),
    }),
    maybeTrain(engineConfig.trainEveryMinutes),
  ]);

  // Final safety net: BUY THIS must be amazon.com/dp/ASIN (or non-Amazon experience URL).
  const safeItems = items.filter((i) => {
    const url = i.product.buyUrl;
    if (isAmazonSearchUrl(url)) {
      console.warn("engine: stripping search URL from final results", i.product.title);
      return false;
    }
    const shop = i.product.giftType === "physical" || i.product.giftType === "giftcard";
    if (shop && !isAmazonPdpUrl(url)) {
      console.warn("engine: stripping non-PDP shop gift", i.product.title);
      return false;
    }
    return true;
  });

  return {
    recommendationId: meta.recommendationId,
    modelVersion: meta.modelVersion,
    strategy: meta.strategy,
    tip: meta.tip,
    items: safeItems,
    total: safeItems.length,
    pageSize: engineConfig.pageSize,
  };
}

function emptyResult(modelVersion: string, strategy: RecommendationResult["strategy"]): RecommendationResult {
  return {
    recommendationId: null,
    modelVersion,
    strategy,
    tip: null,
    items: [],
    total: 0,
    pageSize: engineConfig.pageSize,
  };
}

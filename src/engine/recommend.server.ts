import { AiUnavailableError as ClaudeUnavailableError, claudeSuggestGifts } from "./ai/claude-suggest.server";
import { aiRerank, AiUnavailableError as LovableUnavailableError } from "./ai/reranker.server";
import { toBuyUrl } from "./affiliates/links";
import { enrichProductImages } from "./catalog/product-images";
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
 * Main recommendation entry point (server-only).
 *
 * Returns a dynamic list of gifts (ENGINE_RECOMMENDATION_COUNT), sorted by
 * popularity/engagement then fit. Each item gets a slot label
 * (The One / The Wow / The Smart Pick / The Wildcard). UI paginates.
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
        const merged = mergeClaudeWithCatalog(suggested.items, catalogScored, limit, ctx.sessionId);
        const withImages = await enrichProductImages(merged);
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

function mergeClaudeWithCatalog(
  claudeItems: Recommendation[],
  catalogScored: ScoredProduct[],
  limit: number,
  sessionId: string | null,
): Recommendation[] {
  const asScored: ScoredProduct[] = claudeItems.map((item) => ({
    product: item.product,
    score: item.score,
    breakdown: { content: 0.9, budget: 0.9, behavior: 0, popularity: item.product.popularity / 100, ai: 1 },
    reasons: [item.reason.replace(/^Picked because it\s+/i, "").replace(/\.$/, "") || "matches the questionnaire"],
  }));

  const seen = new Set(asScored.map((s) => normalizeTitle(s.product.title)));
  for (const s of catalogScored) {
    const key = normalizeTitle(s.product.title);
    if (seen.has(key)) continue;
    seen.add(key);
    asScored.push(s);
    if (asScored.length >= limit * 2) break;
  }

  return assignSlotsToAll(asScored)
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
      fromCatalog.get(i.product.id) ?? { content: 0.9, budget: 0.9, behavior: 0, popularity: 0, ai: 1 },
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
  let items: Recommendation[] = assignSlotsToAll(scored)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      product: {
        ...item.product,
        buyUrl: toBuyUrl(item.product.buyUrl, { customId: ctx.sessionId }),
      },
    }));
  let strategy: RecommendationResult["strategy"] = "scoring";
  let tip: string | null = null;

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
              product: {
                ...s.product,
                buyUrl: toBuyUrl(s.product.buyUrl, { customId: ctx.sessionId }),
              },
              score: Number(s.score.toFixed(4)),
              reason: p.reason,
            } satisfies Recommendation;
          })
          .filter((x): x is Recommendation => x !== null);

        // Keep AI top picks first, then fill remaining from scored list.
        const used = new Set(aiItems.map((x) => x.product.id));
        const rest = assignSlotsToAll(scored.filter((s) => !used.has(s.product.id))).map((item) => ({
          ...item,
          product: {
            ...item.product,
            buyUrl: toBuyUrl(item.product.buyUrl, { customId: ctx.sessionId }),
          },
        }));
        items = [...aiItems, ...rest].slice(0, limit).map((item, i) => ({ ...item, rank: i + 1 }));
        tip = ai.tip;
        strategy = "hybrid-ai";
      }
    } catch (err) {
      if (err instanceof LovableUnavailableError) aiPausedUntil = Date.now() + 30 * 60_000;
      console.error("engine: AI re-rank failed, using scoring only", err);
    }
  }

  items = await enrichProductImages(items);
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

  return {
    recommendationId: meta.recommendationId,
    modelVersion: meta.modelVersion,
    strategy: meta.strategy,
    tip: meta.tip,
    items,
    total: items.length,
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

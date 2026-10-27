import { toBuyUrl } from "./affiliates/links";
import { enrichProductImages } from "./catalog/product-images";
import {
  emergencyGiftList,
  isAmazonPdpUrl,
  isAmazonSearchUrl,
  validateRecommendations,
} from "./catalog/product-validator";
import { engineConfig } from "./config";
import {
  activeModelVersion,
  loadProducts,
  loadStats,
  maybeTrain,
  saveRecommendations,
  upsertSuggestedProducts,
} from "./data/engine-repository";
import { extractProfileFeatures } from "./features/profile";
import { keywordSearchRecommend } from "./keyword-recommend.server";
import { assignSlotsToAll } from "./scoring/ranker";
import { scoreProducts } from "./scoring/scorer";
import type {
  EngineLogEntry,
  Recommendation,
  RecipientProfile,
  RecommendationResult,
  RecommendStreamEvent,
  ScoredProduct,
} from "./types";
import { engineError, engineLog, engineWarn, takeEngineLogs, withEngineLogs } from "./utils/logger";

/**
 * Gift Brain entry: questionnaire → tight search phrases → Amazon/catalog →
 * answer-fit scoring. Training runs from BUY THIS clicks only (not suggestions).
 */
export async function recommend(
  profile: RecipientProfile,
  ctx: { searchId: string | null; sessionId: string | null },
  opts?: { onLog?: (entry: EngineLogEntry) => void },
): Promise<RecommendationResult> {
  const { value, logs } = await withEngineLogs(
    () => recommendInner(profile, ctx),
    opts?.onLog ? { onLog: opts.onLog } : undefined,
  );
  return { ...value, engineLogs: logs };
}

/** Streams live progress events, then a final result. */
export async function* recommendStream(
  profile: RecipientProfile,
  ctx: { searchId: string | null; sessionId: string | null },
): AsyncGenerator<RecommendStreamEvent> {
  type Queued = RecommendStreamEvent;
  const queue: Queued[] = [];
  let wake: (() => void) | null = null;
  let finished = false;

  const bump = () => {
    wake?.();
    wake = null;
  };

  const run = recommend(profile, ctx, {
    onLog: (entry) => {
      queue.push({ type: "progress", entry });
      bump();
    },
  })
    .then((result) => {
      queue.push({ type: "result", result });
      finished = true;
      bump();
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      queue.push({ type: "error", message });
      finished = true;
      bump();
    });

  while (!finished || queue.length > 0) {
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (finished) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  await run;
}

async function recommendInner(
  profile: RecipientProfile,
  ctx: { searchId: string | null; sessionId: string | null },
): Promise<RecommendationResult> {
  if (!engineConfig.enabled) {
    engineWarn("engine: disabled — returning empty result");
    return emptyResult("disabled", "scoring");
  }

  engineLog(
    "engine: recommend start",
    `mode=${engineConfig.mode}`,
    `relationship=${profile.relationship || "—"}`,
    `occasion=${profile.occasion || "—"}`,
    `age=${profile.ageRange || "—"}`,
    `gender=${profile.gender || "—"}`,
    `budget=${profile.budget || "—"}`,
  );

  const features = extractProfileFeatures(profile);
  const version = await activeModelVersion();
  const modelVersion = `${version}+${engineConfig.featureVersion}`;
  const limit = Math.min(24, Math.max(4, engineConfig.recommendationCount));

  const [products, stats] = await Promise.all([loadProducts(), loadStats(features.segment)]);
  const catalogScored = scoreProducts(features, products, stats);

  try {
    const keyed = await keywordSearchRecommend({
      profile,
      features,
      sessionId: ctx.sessionId,
      statsByProduct: stats,
      catalogProducts: products,
    });
    if (keyed?.items.length) {
      let items = keyed.items;
      if (items.length < 4) {
        items = await ensureNonEmpty(items, catalogScored, features, 4, ctx.sessionId, profile);
      }
      await upsertSuggestedProducts(items);
      engineLog(`engine: gift brain ok — ${items.length} gifts`);
      return finalize(items, {
        recommendationId: crypto.randomUUID(),
        modelVersion,
        strategy: "gift-brain",
        tip: keyed.tip,
        segment: features.segment,
        searchId: ctx.searchId,
        sessionId: ctx.sessionId,
        breakdowns: breakdownMap(items, catalogScored),
      });
    }
    engineWarn("engine: gift brain returned no gifts — filling from catalog");
  } catch (err) {
    engineError("engine: gift brain failed — filling from catalog", err);
  }

  return catalogFill(profile, features, modelVersion, ctx, catalogScored, limit);
}

async function ensureNonEmpty(
  items: Recommendation[],
  catalogScored: ScoredProduct[],
  features: ReturnType<typeof extractProfileFeatures>,
  limit: number,
  sessionId: string | null,
  profile?: RecipientProfile,
): Promise<Recommendation[]> {
  if (items.length >= Math.min(4, limit)) return items.slice(0, limit);
  engineWarn(`engine: only ${items.length} gifts — filling from emergency catalog`);
  let scoredPool = catalogScored;
  if (profile && /baby shower/i.test(profile.occasion)) {
    const babyFirst = catalogScored.filter(
      (s) =>
        s.product.occasions?.some((o) => /baby shower/i.test(o)) ||
        s.product.category.toLowerCase() === "baby" ||
        /baby|swaddle|diaper|nursery|postpartum/i.test(`${s.product.title} ${s.product.tags.join(" ")}`),
    );
    if (babyFirst.length) scoredPool = babyFirst;
  }
  let fillerDraft = emergencyGiftList(scoredPool, features, limit * 2);
  if (!fillerDraft.length && (features.ageGroup === "child" || features.ageGroup === "teen")) {
    engineWarn("engine: no age-matched emergency gifts — softening age filter for catalog fill");
    fillerDraft = emergencyGiftList(
      scoredPool.filter((s) => s.product.ageGroups.includes(features.ageGroup) || s.product.audience === "kids"),
      { ...features, gender: features.gender },
      limit * 2,
    );
  }
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
  return assignSlotsToAll(
    merged.map((m) => ({
      product: m.product,
      score: m.score,
      breakdown: { content: 0.7, budget: 1, behavior: 0, popularity: 0, ai: 0 },
      reasons: [m.reason],
    })),
  ).slice(0, limit);
}

function breakdownMap(items: Recommendation[], catalogScored: ScoredProduct[]) {
  const fromCatalog = new Map(catalogScored.map((s) => [s.product.id, s.breakdown]));
  return new Map(
    items.map((i) => [
      i.product.id,
      fromCatalog.get(i.product.id) ?? { content: 0.9, budget: 1, behavior: 0, popularity: 0, ai: 0 },
    ]),
  );
}

/** Last-resort catalog scoring when Amazon search returns nothing. */
async function catalogFill(
  profile: RecipientProfile,
  features: ReturnType<typeof extractProfileFeatures>,
  modelVersion: string,
  ctx: { searchId: string | null; sessionId: string | null },
  scored: ScoredProduct[],
  limit: number,
): Promise<RecommendationResult> {
  let pool = scored;
  if (/baby shower/i.test(profile.occasion)) {
    const baby = scored.filter(
      (s) =>
        s.product.occasions?.some((o) => /baby shower/i.test(o)) ||
        s.product.category.toLowerCase() === "baby",
    );
    if (baby.length) pool = baby;
  }
  let draft = assignSlotsToAll(pool).slice(0, limit * 2);
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

  items = await ensureNonEmpty(items, pool, features, limit, ctx.sessionId, profile);
  items = enrichProductImages(items);
  const breakdowns = new Map(scored.map((s) => [s.product.id, s.breakdown]));
  return finalize(items, {
    recommendationId: crypto.randomUUID(),
    modelVersion,
    strategy: "scoring",
    tip: "Dominique matched catalog gifts to their answers and budget.",
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

  const safeItems = items.filter((i) => {
    const url = i.product.buyUrl;
    if (isAmazonSearchUrl(url)) {
      engineWarn("engine: stripping search URL from final results", i.product.title);
      return false;
    }
    const shop = i.product.giftType === "physical" || i.product.giftType === "giftcard";
    if (shop && !isAmazonPdpUrl(url)) {
      engineWarn("engine: stripping non-PDP shop gift", i.product.title);
      return false;
    }
    return true;
  });

  engineLog(
    `engine: finalize strategy=${meta.strategy} gifts=${safeItems.length}`,
    safeItems.map((i) => `${i.slot}:${i.product.title}`).join(" | "),
  );

  return {
    recommendationId: meta.recommendationId,
    modelVersion: meta.modelVersion,
    strategy: meta.strategy,
    tip: meta.tip,
    items: safeItems,
    total: safeItems.length,
    pageSize: engineConfig.pageSize,
    engineLogs: takeEngineLogs().slice(),
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
    engineLogs: takeEngineLogs().slice(),
  };
}

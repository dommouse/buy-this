import { claudeFinalPick } from "./ai/final-picker.server";
import { enrichProductImages, extractAsin } from "./catalog/product-images";
import { validateRecommendations } from "./catalog/product-validator";
// Side-effect: wires Amazon title→ASIN crawl into live product resolve.
import { searchAmazonAllSlots, takeLastBatchTip } from "./stores/amazon-search.server";
import { recallTrendingMatches } from "./brain/memory";
import { buildFilterSpec, filterWithFallback, hardFilterCandidates } from "./brain/filters";
import { buildSearchObjects } from "./brain/search-object";
import { scoreGiftFit } from "./brain/scorer";
import { engineConfig } from "./config";
import { genderMismatch, rankByAnswerFit } from "./features/fit";
import type { ProfileFeatures } from "./features/profile";
import { formatPickReason, SLOTS } from "./scoring/ranker";
import { searchCuratedProducts, setCuratedExtraProducts } from "./stores/curated-search.server";
import { storeProductToProduct } from "./stores";
import type { Product, ProductStats, RecipientProfile, Recommendation, Slot } from "./types";
import { engineLog, engineWarn } from "./utils/logger";

export type KeywordSearchOutcome = {
  tip: string | null;
  items: Recommendation[];
};

function pickFourSlots(
  pool: Product[],
  profile: RecipientProfile,
  features: ProfileFeatures,
  phrases: { slot: Slot; phrase: string; angle: string }[],
  statsByProduct?: Map<string, ProductStats[]>,
): Recommendation[] {
  const used = new Set<string>();
  const usedTitles = new Set<string>();
  const items: Recommendation[] = [];
  const phraseBySlot = new Map(phrases.map((p) => [p.slot, p]));
  const ranked = rankByAnswerFit(
    pool.filter((p) => !genderMismatch(p, features.gender, features.ageGroup)),
    profile,
    features,
    statsByProduct,
  );

  for (const slot of SLOTS) {
    const product = ranked.find((p) => {
      const asin = extractAsin(p.buyUrl)?.toUpperCase() || p.id;
      return !used.has(asin) && !usedTitles.has(p.title.toLowerCase());
    });
    if (!product) continue;
    const asin = extractAsin(product.buyUrl)?.toUpperCase() || product.id;
    used.add(asin);
    usedTitles.add(product.title.toLowerCase());
    const phrase = phraseBySlot.get(slot);
    const score = Number(
      Math.min(0.99, 0.5 + scoreGiftFit(product, profile, features, statsByProduct) * 0.45).toFixed(4),
    );
    items.push({
      slot,
      rank: items.length + 1,
      product,
      score,
      reason: formatPickReason(
        [`Because it matches their answers for ${phrase?.phrase || slot}`],
        phrase?.angle || "",
      ),
    });
  }
  return items.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 }));
}

/**
 * Gift Brain — local SearchObjects + dual catalog (curated + Amazon).
 * Optional Claude final pick when ENGINE_USE_AI=true.
 */
export async function keywordSearchRecommend(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  sessionId: string | null;
  statsByProduct?: Map<string, ProductStats[]>;
  catalogProducts?: Product[];
}): Promise<KeywordSearchOutcome | null> {
  const { profile, features, sessionId, statsByProduct, catalogProducts = [] } = input;

  engineLog("engine: gift brain start (search objects + dual catalog)");
  const spec = buildFilterSpec(profile, features);
  engineLog(
    "engine: answer bounds",
    `path=${profile.path || "?"} age=${spec.ageRange || features.ageGroup} budget=${spec.priceMin}-${spec.priceMax}`,
  );

  const searchObjects = buildSearchObjects(profile, features);
  for (const so of searchObjects) {
    engineLog(`engine: search object ${so.slot} →`, `${so.keywords} [${so.category}] $${so.priceMin}-${so.priceMax}`);
  }

  setCuratedExtraProducts(catalogProducts);

  // Curated / local pool filtered by Dominique column order.
  const curatedPool = filterWithFallback(catalogProducts, spec, profile, features, 15);
  engineLog(`engine: curated pool after filters: ${curatedPool.length}`);

  const memory = recallTrendingMatches({
    profile,
    features,
    products: catalogProducts,
    statsByProduct: statsByProduct ?? new Map(),
    limit: 6,
  });

  const wallMin = spec.priceMin;
  const wallMax = spec.priceMax;

  // Per-slot Amazon + curated keyword hits
  const candidates: Product[] = [...curatedPool, ...memory];
  const usedAsins = new Set<string>();

  if (engineConfig.catalogMode !== "local") {
    try {
      const rawBySlot = await searchAmazonAllSlots({
        slots: searchObjects.map((s) => ({
          slot: s.slot,
          phrase: s.keywords,
          angle: s.category,
        })),
        maxPriceUsd: wallMax,
        minPriceUsd: wallMin,
        ageGroup: features.ageGroup,
        gender: features.gender,
        interests: profile.interests.slice(0, 6),
        ...(features.ageRange ? { ageRange: features.ageRange } : {}),
        ...(profile.relationship ? { relationship: profile.relationship } : {}),
        ...(profile.occasion ? { occasion: profile.occasion } : {}),
        perSlotLimit: 5,
      });
      takeLastBatchTip();
      for (const so of searchObjects) {
        for (const hit of rawBySlot.get(so.slot) ?? []) {
          candidates.push(storeProductToProduct(hit));
        }
        // Backup keywords if thin
        const curatedHits = searchCuratedProducts({
          phrase: so.backup.keywords,
          maxPriceUsd: wallMax,
          minPriceUsd: wallMin,
          ageGroup: features.ageGroup,
          limit: 4,
        }).map(storeProductToProduct);
        candidates.push(...curatedHits);
      }
    } catch (err) {
      engineWarn("engine: Amazon search failed — curated only", err);
    }
  } else {
    for (const so of searchObjects) {
      candidates.push(
        ...searchCuratedProducts({
          phrase: so.keywords,
          maxPriceUsd: wallMax,
          minPriceUsd: wallMin,
          ageGroup: features.ageGroup,
          limit: 6,
        }).map(storeProductToProduct),
      );
    }
  }

  // Dedupe + hard filters
  const deduped: Product[] = [];
  const seen = new Set<string>();
  for (const p of candidates) {
    const key = (extractAsin(p.buyUrl) || p.id).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }

  const filtered = hardFilterCandidates(deduped, spec, profile, features, usedAsins);
  engineLog(`engine: ${filtered.length} candidates after hard filters`);

  const draft: Recommendation[] = filtered.slice(0, 40).map((product, i) => ({
    slot: SLOTS[i % SLOTS.length]!,
    rank: i + 1,
    product,
    score: 0.7,
    reason: "matches answers",
  }));

  const alive = await validateRecommendations(draft, { features, sessionId });
  engineLog(`engine: ${alive.length} candidates passed live checks`);
  engineLog(
    `engine: live diagnostic — path=${profile.path || "?"} occasion=${profile.occasion || "?"} personality=${(profile.personality || []).join("|") || "—"} talkAbout=${(profile.talkAbout || "").slice(0, 60) || "—"} survivors=${alive.length}/${filtered.length}`,
  );
  if (alive.length) {
    engineLog(
      `engine: survivor titles — ${alive
        .slice(0, 8)
        .map((a) => a.product.title.slice(0, 48))
        .join(" | ")}`,
    );
  }

  if (!alive.length) {
    engineWarn("engine: no products survived validation");
    return null;
  }

  const aliveProducts = alive.map((a) => a.product);

  // Hybrid Claude final pick
  if (engineConfig.useAi && engineConfig.anthropicApiKey) {
    const claude = await claudeFinalPick({
      profile,
      candidates: aliveProducts,
      ...(profile.photoDataUrl !== undefined ? { photoDataUrl: profile.photoDataUrl } : {}),
    });
    if (claude?.items.length === 4) {
      const items = enrichProductImages(claude.items);
      engineLog("engine: gift brain ok — Claude final pick");
      return { tip: claude.tip, items };
    }
    engineWarn("engine: Claude final pick skipped — local pick");
  }

  engineLog("engine: picking best gifts locally (answer fit + trending)");
  const picked = pickFourSlots(
    aliveProducts,
    profile,
    features,
    searchObjects.map((s) => ({ slot: s.slot, phrase: s.keywords, angle: s.category })),
    statsByProduct,
  );

  if (!picked.length) {
    engineWarn("engine: gift brain could not pick gifts");
    return null;
  }

  const items = enrichProductImages(picked);
  engineLog(`engine: gift brain ok — ${items.length} gifts`);
  return {
    tip: "Dominique matched these to their answers — a short handwritten note makes any of them feel more personal.",
    items,
  };
}

export class AiUnavailableError extends Error {}

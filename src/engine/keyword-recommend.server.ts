import { AiUnavailableError } from "./ai/claude-client.server";
import { enrichProductImages, extractAsin } from "./catalog/product-images";
import { validateRecommendations } from "./catalog/product-validator";
import { answerBounds, rankByAnswerFit } from "./features/fit";
import type { ProfileFeatures } from "./features/profile";
import { buildSlotPhrases, filterAndPivotPhrases } from "./keywords";
import { formatPickReason, SLOTS } from "./scoring/ranker";
import { searchAmazonAllSlots, takeLastBatchTip } from "./stores/amazon-search.server";
import { getActiveStoreAdapters, storeProductToProduct } from "./stores";
import type { Product, RecipientProfile, Recommendation, Slot } from "./types";
import { engineLog, engineWarn } from "./utils/logger";

export type KeywordSearchOutcome = {
  tip: string | null;
  items: Recommendation[];
};

/**
 * Fast local pick: best unused product per slot by answer fit.
 * Fills empty slots from the leftover pool so we still return 4 gifts.
 */
function pickFourSlots(
  bySlot: Map<Slot, Product[]>,
  profile: RecipientProfile,
  features: ProfileFeatures,
  phrases: { slot: Slot; phrase: string; angle: string }[],
): Recommendation[] {
  const used = new Set<string>();
  const usedTitles = new Set<string>();
  const items: Recommendation[] = [];
  const phraseBySlot = new Map(phrases.map((p) => [p.slot, p]));

  for (const slot of SLOTS) {
    const ranked = rankByAnswerFit(bySlot.get(slot) ?? [], profile, features);
    const product = ranked.find((p) => {
      const asin = extractAsin(p.buyUrl)?.toUpperCase() || p.id;
      const title = p.title.toLowerCase();
      return !used.has(asin) && !usedTitles.has(title);
    });
    if (!product) continue;
    const asin = extractAsin(product.buyUrl)?.toUpperCase() || product.id;
    used.add(asin);
    usedTitles.add(product.title.toLowerCase());
    const phrase = phraseBySlot.get(slot);
    items.push({
      slot,
      rank: items.length + 1,
      product,
      score: Number(Math.max(0.55, 0.95 - items.length * 0.05).toFixed(4)),
      reason: formatPickReason(
        [`Because it matches their answers for ${phrase?.phrase || slot}`],
        phrase?.angle || "",
      ),
    });
  }

  // Fill missing slots from any leftover validated products.
  if (items.length < 4) {
    const pool: Product[] = [];
    for (const list of bySlot.values()) pool.push(...list);
    const ranked = rankByAnswerFit(pool, profile, features);
    for (const slot of SLOTS) {
      if (items.some((i) => i.slot === slot)) continue;
      const product = ranked.find((p) => {
        const asin = extractAsin(p.buyUrl)?.toUpperCase() || p.id;
        return !used.has(asin) && !usedTitles.has(p.title.toLowerCase());
      });
      if (!product) continue;
      const asin = extractAsin(product.buyUrl)?.toUpperCase() || product.id;
      used.add(asin);
      usedTitles.add(product.title.toLowerCase());
      items.push({
        slot,
        rank: items.length + 1,
        product,
        score: 0.6,
        reason: formatPickReason(["Because it still fits their age, budget, and interests"], "backup pick"),
      });
    }
  }

  return items.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 }));
}

/**
 * Primary gift flow (optimized for live):
 * 1 Claude phrase build → blocklist → 1 Claude batch product search → parallel soft ASIN checks → local 4-slot pick.
 * Avoids 4+ sequential store searches and a second picker Claude call (was causing 1 gift + long waits on live).
 */
export async function keywordSearchRecommend(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  sessionId: string | null;
}): Promise<KeywordSearchOutcome | null> {
  const { profile, features, sessionId } = input;
  const bounds = answerBounds(profile, features);

  engineLog("engine: building search phrases");
  const draftPhrases = await buildSlotPhrases({ profile, features });
  const phrases = await filterAndPivotPhrases({ phrases: draftPhrases, profile, features });
  if (!phrases.length) {
    engineWarn("engine: all search phrases blocked after pivots");
    return null;
  }

  engineLog(
    "engine: search phrases",
    phrases.map((p) => `${p.slot}: ${p.phrase}`).join(" | "),
  );
  engineLog(
    "engine: answer bounds",
    `age=${bounds.ageRange || bounds.ageGroup} gender=${bounds.gender} budget=${bounds.minUsd ?? "?"}-${bounds.maxUsd ?? "?"}`,
  );

  const stores = getActiveStoreAdapters();
  if (!stores.length) {
    engineWarn("engine: no store adapters enabled");
    return null;
  }

  const [minUsd, maxUsd] = features.budget ?? [null, null];

  // Single batch Claude call for all slots (big latency win).
  const rawBySlot = await searchAmazonAllSlots({
    slots: phrases.map((p) => ({ slot: p.slot, phrase: p.phrase, angle: p.angle })),
    maxPriceUsd: maxUsd,
    minPriceUsd: minUsd,
    ageGroup: features.ageGroup,
    gender: features.gender,
    interests: bounds.interests.slice(0, 6),
    perSlotLimit: 4,
    ...(features.ageRange ? { ageRange: features.ageRange } : {}),
    ...(profile.relationship ? { relationship: profile.relationship } : {}),
    ...(profile.occasion ? { occasion: profile.occasion } : {}),
    ...(profile.vibe ? { vibe: profile.vibe } : {}),
  });
  const batchTip = takeLastBatchTip();

  // Flatten → validate once in parallel soft-probe path.
  const draft: Recommendation[] = [];
  for (const phrase of phrases) {
    const products = (rawBySlot.get(phrase.slot) ?? []).map(storeProductToProduct);
    for (const product of products) {
      draft.push({
        slot: phrase.slot,
        rank: draft.length + 1,
        product,
        score: 0.7,
        reason: phrase.angle,
      });
    }
  }

  engineLog(`engine: validating ${draft.length} candidates across all slots`);
  const alive = await validateRecommendations(draft, { features, sessionId });
  engineLog(`engine: ${alive.length} candidates passed live checks`);

  // If too thin, one widened batch (soft min price) — still a single Claude call.
  let tip = batchTip;
  if (alive.length < 4) {
    engineWarn("engine: widening search — fewer than 4 validated gifts");
    const wideRaw = await searchAmazonAllSlots({
      slots: phrases.map((p) => ({
        slot: p.slot,
        phrase: `${p.phrase} gift ideas ${bounds.interests[0] || bounds.vibe || ""}`.replace(/\s+/g, " ").trim(),
        angle: p.angle,
      })),
      maxPriceUsd: maxUsd,
      minPriceUsd: null,
      ageGroup: features.ageGroup,
      gender: features.gender,
      interests: bounds.interests.slice(0, 6),
      perSlotLimit: 5,
      ...(features.ageRange ? { ageRange: features.ageRange } : {}),
      ...(profile.relationship ? { relationship: profile.relationship } : {}),
      ...(profile.occasion ? { occasion: profile.occasion } : {}),
      ...(profile.vibe ? { vibe: profile.vibe } : {}),
    });
    tip = takeLastBatchTip() || tip;
    const moreDraft: Recommendation[] = [];
    const seenAsin = new Set(alive.map((a) => extractAsin(a.product.buyUrl)?.toUpperCase()).filter(Boolean) as string[]);
    for (const phrase of phrases) {
      for (const hit of wideRaw.get(phrase.slot) ?? []) {
        const product = storeProductToProduct(hit);
        const asin = (hit.externalId || extractAsin(product.buyUrl) || "").toUpperCase();
        if (asin && seenAsin.has(asin)) continue;
        if (asin) seenAsin.add(asin);
        moreDraft.push({
          slot: phrase.slot,
          rank: moreDraft.length + 1,
          product,
          score: 0.65,
          reason: phrase.angle,
        });
      }
    }
    engineLog(`engine: validating ${moreDraft.length} widened candidates`);
    const moreAlive = await validateRecommendations(moreDraft, { features, sessionId });
    engineLog(`engine: widened found ${moreAlive.length} validated`);
    alive.push(...moreAlive);
  }

  if (!alive.length) {
    engineWarn("engine: store search returned no products for any slot");
    return null;
  }

  // Group validated products back by slot for picking.
  const bySlot = new Map<Slot, Product[]>();
  for (const slot of SLOTS) bySlot.set(slot, []);
  for (const item of alive) {
    const list = bySlot.get(item.slot as Slot) ?? [];
    list.push(item.product);
    bySlot.set(item.slot as Slot, list);
  }

  engineLog("engine: picking best gifts for 4 slots");
  const picked = pickFourSlots(
    bySlot,
    profile,
    features,
    phrases.map((p) => ({ slot: p.slot, phrase: p.phrase, angle: p.angle })),
  );

  if (!picked.length) {
    engineWarn("engine: keyword picks failed ASIN/budget validation");
    return null;
  }

  engineLog(`engine: final validation of picked gifts`);
  // Products already passed soft probe — skip a second full probe pass (latency).
  const items = enrichProductImages(picked);
  engineLog(`engine: keyword-search ok — ${items.length} gifts`);

  return {
    tip:
      tip ||
      "Dominique matched these to their answers — a short handwritten note makes any of them feel more personal.",
    items,
  };
}

export { AiUnavailableError };

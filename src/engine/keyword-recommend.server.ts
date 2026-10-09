import { AiUnavailableError } from "./ai/claude-client.server";
import { pickBestPerSlot } from "./ai/slot-picker.server";
import { enrichProductImages, extractAsin } from "./catalog/product-images";
import { validateRecommendations } from "./catalog/product-validator";
import { answerBounds, rankByAnswerFit } from "./features/fit";
import type { ProfileFeatures } from "./features/profile";
import { buildSlotPhrases, filterAndPivotPhrases } from "./keywords";
import { getActiveStoreAdapters, storeProductToProduct } from "./stores";
import type { Product, RecipientProfile, Recommendation } from "./types";
import { engineError, engineLog, engineWarn } from "./utils/logger";

export type KeywordSearchOutcome = {
  tip: string | null;
  items: Recommendation[];
};

/**
 * Primary gift flow:
 * questionnaire → keyword phrases (per slot) → blocklist pivot → store search → AI pick 4.
 * Searches slots sequentially so each slot excludes ASINs already chosen,
 * validates live PDP candidates BEFORE picking, and ranks by age/budget/gender fit.
 */
export async function keywordSearchRecommend(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  sessionId: string | null;
}): Promise<KeywordSearchOutcome | null> {
  const { profile, features, sessionId } = input;
  const bounds = answerBounds(profile, features);

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
  const excludeIds: string[] = [];
  const slotCandidates: { slot: (typeof phrases)[number]["slot"]; phrase: (typeof phrases)[number]; products: Product[] }[] =
    [];

  // Sequential per slot so excludeIds accumulate and gifts stay distinct.
  for (const phrase of phrases) {
    const found: Product[] = [];
    const seen = new Set<string>();

    for (const store of stores) {
      try {
        const hits = await store.search({
          phrase: phrase.phrase,
          maxPriceUsd: maxUsd,
          minPriceUsd: minUsd,
          ageGroup: features.ageGroup,
          gender: features.gender,
          interests: bounds.interests.slice(0, 6),
          limit: 6,
          ...(features.ageRange ? { ageRange: features.ageRange } : {}),
          ...(profile.relationship ? { relationship: profile.relationship } : {}),
          ...(profile.occasion ? { occasion: profile.occasion } : {}),
          ...(profile.vibe ? { vibe: profile.vibe } : {}),
          ...(excludeIds.length ? { excludeIds: [...excludeIds] } : {}),
        });
        for (const hit of hits) {
          const product = storeProductToProduct(hit);
          if (seen.has(product.id)) continue;
          const asin = (hit.externalId || extractAsin(product.buyUrl) || "").toUpperCase();
          if (asin && excludeIds.includes(asin)) continue;
          seen.add(product.id);
          found.push(product);
        }
      } catch (err) {
        engineError(`engine: store ${store.id} search failed for ${phrase.slot}`, err);
      }
    }

    // Validate live PDP + age/budget/gender BEFORE the picker sees candidates.
    const draftRecs: Recommendation[] = found.map((product, i) => ({
      slot: phrase.slot,
      rank: i + 1,
      product,
      score: 0.7,
      reason: phrase.angle,
    }));
    const alive = await validateRecommendations(draftRecs, { features, sessionId });
    const ranked = rankByAnswerFit(
      alive.map((r) => r.product),
      profile,
      features,
    );

    // Reserve top candidate ASINs so later slots search differently.
    for (const p of ranked.slice(0, 2)) {
      const asin = extractAsin(p.buyUrl)?.toUpperCase();
      if (asin && !excludeIds.includes(asin)) excludeIds.push(asin);
    }

    if (ranked.length) {
      slotCandidates.push({ slot: phrase.slot, phrase, products: ranked });
      engineLog(
        `engine: ${phrase.slot} has ${ranked.length} validated candidates (excluded ${excludeIds.length} asins)`,
      );
    } else {
      engineWarn(`engine: ${phrase.slot} — no validated products for "${phrase.phrase}"`);
    }
  }

  const withProducts = slotCandidates.filter((s) => s.products.length > 0);
  if (!withProducts.length) {
    engineWarn("engine: store search returned no products for any slot");
    return null;
  }

  const picked = await pickBestPerSlot({
    slots: withProducts,
    profile,
    features,
  });
  if (!picked.items.length) return null;

  // Final gate (should mostly pass — candidates were already validated).
  const validated = await validateRecommendations(picked.items, { features, sessionId });
  if (!validated.length) {
    engineWarn("engine: keyword picks failed ASIN/budget validation");
    return null;
  }

  // Dedupe across slots if picker still overlapped.
  const deduped: Recommendation[] = [];
  const seenAsin = new Set<string>();
  const seenTitle = new Set<string>();
  for (const item of validated) {
    const asin = extractAsin(item.product.buyUrl)?.toUpperCase() || "";
    const title = item.product.title.toLowerCase();
    if ((asin && seenAsin.has(asin)) || seenTitle.has(title)) continue;
    if (asin) seenAsin.add(asin);
    seenTitle.add(title);
    deduped.push(item);
  }

  const order = ["The One", "The Wow", "The Smart Pick", "The Wildcard"] as const;
  const sorted = [...deduped].sort(
    (a, b) => order.indexOf(a.slot as (typeof order)[number]) - order.indexOf(b.slot as (typeof order)[number]),
  );
  const items = enrichProductImages(sorted.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 })));

  return { tip: picked.tip, items };
}

export { AiUnavailableError };

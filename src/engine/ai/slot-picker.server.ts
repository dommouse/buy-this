import { engineConfig } from "../config";
import { answerBounds } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import type { SlotPhrase } from "../keywords/types";
import type { Product, RecipientProfile, Recommendation, Slot } from "../types";
import { formatPickReason } from "../scoring/ranker";
import { callClaude, extractJsonObject } from "./claude-client.server";

export type SlotCandidates = {
  slot: Slot;
  phrase: SlotPhrase;
  products: Product[];
};

/**
 * AI picks the best product for each slot from store search results
 * and writes one short presentation tip.
 * Enforces questionnaire bounds + one unique product per slot.
 */
export async function pickBestPerSlot(input: {
  slots: SlotCandidates[];
  profile: RecipientProfile;
  features: ProfileFeatures;
}): Promise<{ tip: string | null; items: Recommendation[] }> {
  const bounds = answerBounds(input.profile, input.features);
  const payload = {
    hardBounds: {
      ageRange: bounds.ageRange,
      ageGroup: bounds.ageGroup,
      gender: bounds.gender,
      budget: { minUsd: bounds.minUsd, maxUsd: bounds.maxUsd },
      relationship: bounds.relationship,
      occasion: bounds.occasion,
      interests: bounds.interests,
      vibe: bounds.vibe,
      avoid: bounds.avoid,
    },
    slots: input.slots.map((s) => ({
      slot: s.slot,
      searchPhrase: s.phrase.phrase,
      angle: s.phrase.angle,
      candidates: s.products.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        price: p.price,
        tags: p.tags,
      })),
    })),
  };

  const genderRule =
    bounds.genderLabel != null
      ? `Prefer candidates clearly suitable for a ${bounds.genderLabel}; skip opposite-gender-only items. `
      : "";

  const system =
    "You are Dominique, gift curator for BUY THIS. " +
    "For each slot, pick exactly ONE candidate id that best matches the HARD questionnaire bounds and that slot's search phrase. " +
    "CRITICAL: each of the 4 slots must get a DIFFERENT product — never repeat the same gift/title/ASIN across slots. " +
    "Respect age, budget max, and gender when answered. " +
    genderRule +
    `Never pick avoided categories: ${engineConfig.avoidCategories.map((c) => c.label).join(", ")}. ` +
    "Cite a concrete questionnaire answer in each reason (age, budget, gender, interest, or occasion). " +
    "Also write one presentation tip (max 30 words). " +
    "Return ONLY JSON: {\"tip\":\"...\",\"picks\":[{\"slot\":\"The One|The Wow|The Smart Pick|The Wildcard\",\"productId\":\"...\",\"reason\":\"Because they…\"}]}.";

  const text = await callClaude(system, JSON.stringify(payload), 35_000);
  const raw = extractJsonObject(text);
  if (!raw) return { tip: null, items: [] };
  const parsed = JSON.parse(raw) as {
    tip?: string;
    picks?: { slot?: string; productId?: string; reason?: string }[];
  };

  const bySlot = new Map(input.slots.map((s) => [s.slot, s]));
  const items: Recommendation[] = [];
  const used = new Set<string>();
  const usedTitles = new Set<string>();

  for (const pick of parsed.picks ?? []) {
    const slot = pick.slot as Slot | undefined;
    const bucket = slot ? bySlot.get(slot) : undefined;
    if (!bucket) continue;
    let product = bucket.products.find((p) => p.id === pick.productId);
    if (!product || used.has(product.id) || usedTitles.has(product.title.toLowerCase())) {
      product = bucket.products.find(
        (p) => !used.has(p.id) && !usedTitles.has(p.title.toLowerCase()),
      );
    }
    if (!product) continue;
    used.add(product.id);
    usedTitles.add(product.title.toLowerCase());
    items.push({
      slot: bucket.slot,
      rank: items.length + 1,
      product,
      score: Number(Math.max(0.55, 0.95 - items.length * 0.05).toFixed(4)),
      reason: formatPickReason(
        [String(pick.reason ?? `Because it matches their answers for ${bucket.phrase.phrase}`)],
        bucket.phrase.angle,
      ),
    });
  }

  // Fill any missing slots with the first unused candidate.
  for (const bucket of input.slots) {
    if (items.some((i) => i.slot === bucket.slot)) continue;
    const product = bucket.products.find(
      (p) => !used.has(p.id) && !usedTitles.has(p.title.toLowerCase()),
    );
    if (!product) continue;
    used.add(product.id);
    usedTitles.add(product.title.toLowerCase());
    items.push({
      slot: bucket.slot,
      rank: items.length + 1,
      product,
      score: 0.6,
      reason: formatPickReason([`Because it matches "${bucket.phrase.phrase}"`], bucket.phrase.angle),
    });
  }

  return {
    tip: typeof parsed.tip === "string" ? parsed.tip.slice(0, 260) : null,
    items: items.slice(0, 4).map((item, i) => ({ ...item, rank: i + 1 })),
  };
}

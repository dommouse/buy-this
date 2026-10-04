import type { Recommendation, ScoredProduct, Slot } from "../types";

export const SLOTS: Slot[] = ["The One", "The Wow", "The Smart Pick", "The Wildcard"];

const SLOT_META_REASON: Record<Slot, string> = {
  "The One": "best overall match for their answers",
  "The Wow": "memorable showstopper energy",
  "The Smart Pick": "practical fit within budget",
  "The Wildcard": "delightful surprise they might not expect",
};

/** Sort: most engaged/popular first, then questionnaire fit score. */
export function sortByPopularityThenScore(scored: ScoredProduct[]): ScoredProduct[] {
  return [...scored].sort((a, b) => {
    const popA = a.product.popularity + a.breakdown.behavior * 20 + a.breakdown.popularity * 10;
    const popB = b.product.popularity + b.breakdown.behavior * 20 + b.breakdown.popularity * 10;
    if (popB !== popA) return popB - popA;
    return b.score - a.score;
  });
}

/**
 * Assign each gift one of: The One | The Wow | The Smart Pick | The Wildcard
 * based on fit to questionnaire signals (not a fixed 4-item list).
 */
export function classifySlot(s: ScoredProduct, index: number, all: ScoredProduct[]): Slot {
  const maxPrice = Math.max(1, ...all.map((x) => x.product.price));
  const topScore = all[0]?.score ?? s.score;
  const fitRatio = topScore > 0 ? s.score / topScore : 0;

  const oneScore = s.breakdown.content * 1.4 + s.score + (fitRatio >= 0.9 ? 0.4 : 0);
  const wowScore =
    (s.product.giftType === "experience" ? 0.55 : 0) +
    (s.product.price / maxPrice) * 0.7 +
    (s.breakdown.content > 0.5 && s.breakdown.budget < 1 ? 0.25 : 0) +
    (/premium|luxury|deluxe|pro |limited/i.test(`${s.product.title} ${s.product.description}`) ? 0.35 : 0);
  const smartScore =
    s.breakdown.budget * 1.3 +
    (s.product.giftType === "physical" || s.product.giftType === "giftcard" ? 0.25 : 0) +
    (s.product.price <= maxPrice * 0.55 ? 0.2 : 0);
  const wildScore =
    0.35 +
    (s.product.giftType === "giftcard" ? 0.2 : 0) +
    (index > 2 ? 0.15 : 0) +
    (1 - s.breakdown.content) * 0.3;

  const ranked: { slot: Slot; score: number }[] = [
    { slot: "The One", score: oneScore },
    { slot: "The Wow", score: wowScore },
    { slot: "The Smart Pick", score: smartScore },
    { slot: "The Wildcard", score: wildScore },
  ].sort((a, b) => b.score - a.score);

  // Light rotation so a long list does not stamp every card as "The One".
  const rotate = index % SLOTS.length;
  const preferred = SLOTS[rotate]!;
  const preferredEntry = ranked.find((r) => r.slot === preferred);
  if (preferredEntry && preferredEntry.score >= (ranked[0]?.score ?? 0) * 0.82) {
    return preferred;
  }
  return ranked[0]!.slot;
}

/** Rank all scored gifts and assign a display slot to each. */
export function assignSlotsToAll(scored: ScoredProduct[]): Recommendation[] {
  const sorted = sortByPopularityThenScore(scored);
  return sorted.map((s, i) => {
    const slot = classifySlot(s, i, sorted);
    const why = s.reasons.length ? s.reasons.slice(0, 2).join(" and ") : SLOT_META_REASON[slot];
    return {
      slot,
      rank: i + 1,
      product: s.product,
      score: Number(s.score.toFixed(4)),
      reason: `Picked because it ${why}.`,
    };
  });
}

/** @deprecated Prefer assignSlotsToAll — kept for narrow 4-pick callers. */
export function assignSlots(scored: ScoredProduct[]): Recommendation[] {
  return assignSlotsToAll(scored).slice(0, 4);
}

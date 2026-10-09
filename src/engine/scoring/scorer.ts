import { engineConfig, matchesAvoidCategory } from "../config";
import { genderMismatch } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import type { Product, ProductStats, ScoredProduct } from "../types";

/** Content match: overlap between profile signals and product tags/text. */
export function contentScore(f: ProfileFeatures, p: Product) {
  const tags = p.tags.map((t) => t.toLowerCase());
  const text = `${p.title} ${p.description}`.toLowerCase();
  const hits = f.signals.filter((s) => tags.includes(s));
  const textHits = f.signals.filter((s) => !tags.includes(s) && s.split("/").some((w) => w.length > 3 && text.includes(w)));
  const score = Math.min(1, (hits.length + textHits.length * 0.5) / 2.5);
  return { score, hits };
}

/**
 * Budget fit score.
 * Over max → 0 (hard fail upstream). Under min is tolerated with a soft penalty.
 */
export function budgetScore(f: ProfileFeatures, p: Product) {
  if (!f.budget) return 0.6;
  const [lo, hi] = f.budget;
  if (p.price > hi) return 0;
  if (p.price >= lo && p.price <= hi) return 1;
  if (lo <= 0) return 1;
  const gap = (lo - p.price) / Math.max(lo, 1);
  return Math.max(0.35, 1 - gap);
}

/** Smoothed click-through rate, weighted by how much evidence exists. */
export function behaviorScore(stats: ProductStats[] | undefined) {
  if (!stats?.length) return { score: 0, confidence: 0 };
  const imp = stats.reduce((a, s) => a + s.impressions, 0);
  const clk = stats.reduce((a, s) => a + s.clicks, 0);
  const ctr = (clk + 1) / (imp + 10); // Bayesian prior ~10%
  return { score: Math.min(1, ctr * 4), confidence: Math.min(1, imp / engineConfig.behaviorConfidenceAt) };
}

export function scoreProducts(
  f: ProfileFeatures,
  products: Product[],
  statsByProduct: Map<string, ProductStats[]>,
): ScoredProduct[] {
  const w = engineConfig.weights;
  const maxPop = Math.max(1, ...products.map((p) => p.popularity));
  return products
    .filter((p) => p.ageGroups.includes(f.ageGroup))
    .filter((p) => !genderMismatch(p, f.gender))
    .filter(
      (p) =>
        !matchesAvoidCategory(`${p.title} ${p.description} ${p.category} ${p.tags.join(" ")}`),
    )
    .filter((p) => !f.avoidWords.some((w) => `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(w)))
    // Age is strict; budget max is strict; budget min is soft (see priceInBudget).
    .filter((p) => {
      if (!f.budget) return true;
      const [, hi] = f.budget;
      if (p.price > hi) return false;
      const [lo] = f.budget;
      if (lo <= 0) return true;
      return p.price >= lo * 0.7;
    })
    .map((product) => {
      const c = contentScore(f, product);
      const b = budgetScore(f, product);
      const beh = behaviorScore(statsByProduct.get(product.id));
      const pop = product.popularity / maxPop;
      const typeBoost = f.giftType && product.giftType === f.giftType ? 0.08 : 0;
      const genderBoost =
        f.gender === "woman" && /\b(women|ladies|beauty)\b/i.test(`${product.title} ${product.tags.join(" ")}`)
          ? 0.1
          : f.gender === "man" && /\b(men|grooming)\b/i.test(`${product.title} ${product.tags.join(" ")}`)
            ? 0.1
            : 0;
      const amazonBoost =
        engineConfig.amazon.enabled &&
        engineConfig.amazon.preferAmazonFallback &&
        (product.provider === "amazon" || /amazon\./i.test(product.buyUrl))
          ? engineConfig.amazon.sourceBoost
          : 0;
      // Cold start: behavior weight shifts to content until evidence accumulates.
      const behW = w.behavior * beh.confidence;
      const score =
        c.score * (w.content + (w.behavior - behW)) +
        b * w.budget +
        beh.score * behW +
        pop * w.popularity +
        typeBoost +
        genderBoost +
        amazonBoost;
      const reasons = [
        ...c.hits.map((h) => `matches ${h}`),
        b === 1 ? "fits the budget" : "",
        genderBoost > 0 ? "suits their gender" : "",
        beh.confidence > 0.3 && beh.score > 0.5 ? "popular with similar shoppers" : "",
        amazonBoost > 0 ? "available on Amazon" : "",
      ].filter(Boolean);
      return { product, score, reasons, breakdown: { content: c.score, budget: b, behavior: beh.score, popularity: pop, ai: 0 } };
    })
    .sort((a, b) => b.score - a.score);
}

import { answerFitScore, trendingFitScore } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import { matchesAvoidCategory } from "../config";
import type { Product, ProductStats, RecipientProfile } from "../types";

/** Feature lambda: (product, context) → contribution in [0, 1]. */
export type FitLambda = (product: Product, ctx: FitContext) => number;

export type FitContext = {
  profile: RecipientProfile;
  features: ProfileFeatures;
  statsByProduct?: Map<string, ProductStats[]>;
};

const answerLambda: FitLambda = (p, ctx) => answerFitScore(p, ctx.profile, ctx.features);
const trendingLambda: FitLambda = (p, ctx) =>
  trendingFitScore(p, ctx.profile, ctx.features, ctx.statsByProduct);
const avoidLambda: FitLambda = (p) => {
  const hit = matchesAvoidCategory(`${p.title} ${p.category} ${p.tags.join(" ")}`);
  return hit ? 0 : 1;
};
const budgetLambda: FitLambda = (p, ctx) => {
  const [min, max] = ctx.features.budget ?? [null, null];
  if (max != null && p.price > max) return 0;
  if (min != null && p.price < min * 0.5) return 0.4;
  if (min != null && p.price < min) return 0.75;
  return 1;
};

const DEFAULT_LAMBDAS: { weight: number; fn: FitLambda }[] = [
  { weight: 0.45, fn: answerLambda },
  { weight: 0.2, fn: budgetLambda },
  { weight: 0.2, fn: trendingLambda },
  { weight: 0.15, fn: avoidLambda },
];

/**
 * Weighted sum of feature lambdas — the Gift Brain’s local “model” score.
 * Training signals flow in via trendingLambda (segment stats).
 */
export function scoreGiftFit(
  product: Product,
  profile: RecipientProfile,
  features: ProfileFeatures,
  statsByProduct?: Map<string, ProductStats[]>,
  lambdas = DEFAULT_LAMBDAS,
): number {
  const ctx: FitContext = { profile, features, ...(statsByProduct ? { statsByProduct } : {}) };
  let totalW = 0;
  let sum = 0;
  for (const { weight, fn } of lambdas) {
    sum += weight * fn(product, ctx);
    totalW += weight;
  }
  return totalW > 0 ? sum / totalW : 0;
}

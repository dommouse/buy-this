import { genderMismatch, trendingFitScore } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import { priceInBudget } from "../catalog/product-validator";
import type { Product, ProductStats, RecipientProfile } from "../types";
import { engineLog } from "../utils/logger";

/**
 * Gift Brain memory — products that already performed well for similar shoppers
 * (same segment click/buy stats). Used as a fast path before / alongside Amazon search.
 */
export function recallTrendingMatches(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  products: Product[];
  statsByProduct: Map<string, ProductStats[]>;
  limit?: number;
}): Product[] {
  const { profile, features, products, statsByProduct } = input;
  const limit = input.limit ?? 8;

  const scored = products
    .filter((p) => p.ageGroups.includes(features.ageGroup))
    .filter((p) => priceInBudget(p.price, features.budget))
    .filter((p) => !genderMismatch(p, features.gender, features.ageGroup))
    .filter((p) => {
      const stats = statsByProduct.get(p.id);
      if (!stats?.length) return false;
      const buys = stats.reduce((a, s) => a + s.clicks, 0);
      // Memory only from BUY THIS training — no suggestion-impression noise.
      return buys >= 1;
    })
    .map((p) => ({
      product: p,
      score: trendingFitScore(p, profile, features, statsByProduct),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.product);

  if (scored.length) {
    engineLog(`engine: gift brain memory recalled ${scored.length} trending matches`);
  }
  return scored;
}

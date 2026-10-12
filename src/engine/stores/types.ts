import { normalizeAudience } from "../features/fit";
import type { GenderFit } from "../features/fit";
import type { AgeGroup, GenderAudience, GiftType, Product } from "../types";

/** Normalized product returned by any store adapter (Amazon today, Nordstrom/Etsy/… later). */
export type StoreProduct = {
  storeId: string;
  externalId: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  buyUrl: string;
  giftType: GiftType;
  ageGroups: AgeGroup[];
  tags: string[];
  /** Who this product is for — women / men / unisex / kids / unknown. */
  audience: GenderAudience;
};

/** Questionnaire bounds + phrase for a store search. */
export type StoreSearchRequest = {
  phrase: string;
  maxPriceUsd: number | null;
  minPriceUsd: number | null;
  ageGroup: AgeGroup;
  /** Exact age label from questionnaire when available (e.g. "30s", "3-5"). */
  ageRange?: string;
  /** Prefer products suited to this gender when answered. */
  gender?: GenderFit;
  relationship?: string;
  occasion?: string;
  interests?: string[];
  vibe?: string;
  /** ASINs / external ids already used in other slots — must not repeat. */
  excludeIds?: string[];
  limit?: number;
};

export type StoreSearchAdapter = {
  id: string;
  label: string;
  /** Search a catalog with a keyword phrase. */
  search: (req: StoreSearchRequest) => Promise<StoreProduct[]>;
};

export function storeProductToProduct(p: StoreProduct): Product {
  const audience = p.audience && p.audience !== "unknown" ? p.audience : normalizeAudience(p.tags.join(" "));
  const tags = [...p.tags];
  if (audience !== "unknown" && !tags.some((t) => t.toLowerCase().startsWith("audience:"))) {
    tags.push(`audience:${audience}`);
  }
  return {
    id: `${p.storeId}-${p.externalId}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency || "USD",
    tags,
    ageGroups: p.ageGroups,
    giftType: p.giftType,
    audience,
    imageUrl: p.imageUrl,
    buyUrl: p.buyUrl,
    provider: p.storeId,
    popularity: 0,
  };
}

import { amazonCatalog } from "../catalog/amazon-catalog";
import { engineConfig } from "../config";
import type { Product } from "../types";
import type { StoreProduct, StoreSearchAdapter, StoreSearchRequest } from "./types";

function productToStore(p: Product): StoreProduct {
  return {
    storeId: "curated",
    externalId: p.id.replace(/^amz-/, "").toUpperCase(),
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency || "USD",
    imageUrl: p.imageUrl,
    buyUrl: p.buyUrl,
    giftType: p.giftType,
    ageGroups: p.ageGroups,
    tags: p.tags,
    audience: p.audience,
  };
}

/** Score a curated product against a keyword phrase. */
function phraseScore(p: Product, phrase: string): number {
  const blob = `${p.title} ${p.description} ${p.category} ${p.tags.join(" ")}`.toLowerCase();
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let score = 0;
  for (const w of words) {
    if (blob.includes(w)) score += 1;
  }
  return score;
}

/**
 * Local / imported catalog adapter. Searches in-memory amazonCatalog merge
 * plus any products passed via `searchCuratedProducts`.
 */
let extraProducts: Product[] = [];

export function setCuratedExtraProducts(products: Product[]) {
  extraProducts = products;
}

export function searchCuratedProducts(req: StoreSearchRequest): StoreProduct[] {
  const pool = [...amazonCatalog, ...extraProducts];
  const limit = req.limit ?? 8;
  const scored = pool
    .filter((p) => {
      if (req.maxPriceUsd != null && p.price > req.maxPriceUsd) return false;
      if (req.minPriceUsd != null && p.price < req.minPriceUsd) return false;
      if (req.ageGroup && p.ageGroups.length && !p.ageGroups.includes(req.ageGroup)) return false;
      return true;
    })
    .map((p) => ({ p, score: phraseScore(p, req.phrase) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
    .slice(0, limit)
    .map((x) => productToStore(x.p));

  // If phrase match empty, return budget-filtered popular curated items.
  if (!scored.length) {
    return pool
      .filter((p) => {
        if (req.maxPriceUsd != null && p.price > req.maxPriceUsd) return false;
        if (req.minPriceUsd != null && p.price < req.minPriceUsd * 0.75) return false;
        return true;
      })
      .slice(0, limit)
      .map(productToStore);
  }
  return scored;
}

export const curatedSearchAdapter: StoreSearchAdapter = {
  id: "curated",
  label: "Curated catalog",
  async search(req) {
    if (engineConfig.catalogMode === "amazon") return [];
    return searchCuratedProducts(req);
  },
};

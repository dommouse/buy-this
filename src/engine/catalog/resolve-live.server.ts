import { amazonAsinUrl } from "../affiliates/amazon";
import type { AgeGroup, Product } from "../types";
import { engineLog, engineWarn } from "../utils/logger";
import { amazonCatalog } from "./amazon-catalog";
import { amazonAsinImageUrl, extractAsin } from "./product-images";

function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(t: string): string[] {
  return normTitle(t)
    .split(" ")
    .filter((w) => w.length > 2 && !/^(the|and|for|with|set|kit|gift|pack)$/.test(w));
}

/** Score how well a candidate title matches the curated gift title. */
function titleOverlap(wanted: string, candidate: string): number {
  const a = titleTokens(wanted);
  const b = new Set(titleTokens(candidate));
  if (!a.length) return 0;
  let hits = 0;
  for (const w of a) if (b.has(w)) hits += 1;
  return hits / a.length;
}

/**
 * Prefer a known curated Amazon /dp product when titles align
 * (instant, no network — recovers Silk Pillowcase etc. from starter/search URLs).
 */
export function matchCuratedByTitle(title: string): Product | null {
  const wanted = normTitle(title);
  if (!wanted) return null;

  let best: Product | null = null;
  let bestScore = 0;

  for (const p of amazonCatalog) {
    const pn = normTitle(p.title);
    if (pn === wanted) return p;
    const score = titleOverlap(wanted, pn);
    // Require strong overlap so "Custom Photo Book" ≠ random book ASINs
    if (score >= 0.6 && score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

export type LiveResolveHit = {
  asin: string;
  title: string;
  price: number;
  source: "curated" | "amazon-search";
};

type SearchFn = (phrase: string, limit: number, ageGroup: AgeGroup) => Promise<
  { externalId: string; title: string; price: number }[]
>;

let searchFn: SearchFn | null = null;

/** Wire Amazon HTML search without a circular import at module load. */
export function setAmazonTitleSearch(fn: SearchFn) {
  searchFn = fn;
}

/**
 * Turn a curated/search-URL/dead-ASIN product into a live /dp/ASIN gift.
 * 1) Local amazon-catalog title match
 * 2) Amazon search crawl for the product title
 */
export async function resolveToLiveProduct(
  product: Product,
  ageGroup: AgeGroup,
): Promise<LiveResolveHit | null> {
  const curated = matchCuratedByTitle(product.title);
  if (curated) {
    const asin = extractAsin(curated.buyUrl);
    if (asin) {
      return {
        asin,
        title: curated.title,
        price: curated.price > 0 ? curated.price : product.price,
        source: "curated",
      };
    }
  }

  if (!searchFn) {
    engineWarn("engine: Amazon title search not wired — curated match only");
    return null;
  }

  // Search with the gift title (trim noise); take best title-overlap hit.
  const phrase = product.title.replace(/\s+/g, " ").trim().slice(0, 80);
  try {
    const hits = await searchFn(phrase, 6, ageGroup);
    let best: LiveResolveHit | null = null;
    let bestScore = 0;
    for (const h of hits) {
      const asin = h.externalId?.toUpperCase();
      if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) continue;
      const score = titleOverlap(product.title, h.title);
      // Accept strong overlap, or any first hit if curated title is generic short
      if (score > bestScore && (score >= 0.35 || titleTokens(product.title).length <= 2)) {
        bestScore = score;
        best = {
          asin,
          title: h.title.slice(0, 140) || product.title,
          price: h.price > 0 ? h.price : product.price,
          source: "amazon-search",
        };
      }
    }
    // If overlap failed but Amazon returned something, take top hit as last resort
    // (better than dropping a relevant curated gift entirely).
    if (!best && hits[0]?.externalId) {
      const asin = hits[0].externalId.toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(asin)) {
        best = {
          asin,
          title: (hits[0].title || product.title).slice(0, 140),
          price: hits[0].price > 0 ? hits[0].price : product.price,
          source: "amazon-search",
        };
        engineLog(`engine: soft-resolved “${product.title.slice(0, 40)}” → top Amazon hit ${asin}`);
      }
    }
    return best;
  } catch (err) {
    engineWarn("engine: live resolve failed", product.title.slice(0, 40), err);
    return null;
  }
}

export function applyLiveHit(product: Product, hit: LiveResolveHit): Product {
  return {
    ...product,
    id: product.id.startsWith("amz-") ? product.id : `amz-${hit.asin.toLowerCase()}`,
    title: hit.title.length >= 6 ? hit.title : product.title,
    price: hit.price > 0 ? hit.price : product.price,
    buyUrl: amazonAsinUrl(hit.asin),
    imageUrl: amazonAsinImageUrl(hit.asin, 300),
    provider: "amazon",
  };
}

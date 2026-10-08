import type { Product } from "../types";

const ASIN_RE = /(?:\/(?:dp|gp\/product|product)\/|ASIN=|asin%2F)([A-Z0-9]{10})(?:[/?&#]|$)/i;

export function extractAsin(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(ASIN_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

export type AsinImageSize = 160 | 250 | 300 | 500;

/**
 * Direct Amazon product image (CDN) — works in the browser.
 * The old Associates widget host (ws-na.amazon-adsystem.com) is often blocked
 * by corporate proxies / ad blockers and shows as a blank placeholder.
 */
export function amazonAsinImageUrl(asin: string, size: AsinImageSize | "_SL160_" | "_SL250_" | "_SL300_" | "_SL500_" = 300): string {
  const clean = asin.trim().toUpperCase();
  const px =
    typeof size === "number"
      ? size
      : Number((size.match(/\d+/) || ["300"])[0]) || 300;
  return `https://m.media-amazon.com/images/P/${clean}.01._SCLZZZZZZZ_SX${px}_.jpg`;
}

/** Secondary CDN — used as <img> onError fallback in the UI. */
export function amazonAsinImageUrlFallback(asin: string, size: AsinImageSize = 300): string {
  const clean = asin.trim().toUpperCase();
  return `https://images-na.ssl-images-amazon.com/images/P/${clean}.01._SCLZZZZZZZ_SX${size}_.jpg`;
}

/**
 * Attach Amazon ASIN thumbnails from buyUrl for every product that has a live ASIN.
 */
export function enrichProductImages<T extends { product: Product }>(items: T[]): T[] {
  return items.map((item) => {
    const asin = extractAsin(item.product.buyUrl) || extractAsin(item.product.imageUrl || "");
    if (!asin) {
      return { ...item, product: { ...item.product, imageUrl: null } };
    }
    return {
      ...item,
      product: {
        ...item.product,
        imageUrl: amazonAsinImageUrl(asin, 300),
      },
    };
  });
}

import type { Product } from "../types";

const ASIN_RE = /(?:\/(?:dp|gp\/product|product)\/|ASIN=|asin%2F)([A-Z0-9]{10})(?:[/?&#]|$)/i;

export function extractAsin(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(ASIN_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

/** Amazon Associates image widget — works for real ASINs without PA-API. */
export function amazonAsinImageUrl(asin: string, size: "_SL250_" | "_SL300_" | "_SL500_" = "_SL300_"): string {
  const params = new URLSearchParams({
    _encoding: "UTF8",
    MarketPlace: "US",
    ASIN: asin.toUpperCase(),
    ServiceVersion: "20070822",
    ID: "AsinImage",
    WS: "1",
    Format: size,
  });
  return `https://ws-na.amazon-adsystem.com/widgets/q?${params.toString()}`;
}

/** Deterministic product photo from Openverse (Creative Commons). */
async function openverseImage(query: string): Promise<string | null> {
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  try {
    const url = new URL("https://api.openverse.org/v1/images/");
    url.searchParams.set("q", q);
    url.searchParams.set("page_size", "1");
    url.searchParams.set("license_type", "commercial");
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "BUYTHIS-GiftConcierge/1.0" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { url?: string; thumbnail?: string }[] };
    const hit = data.results?.[0];
    return hit?.thumbnail || hit?.url || null;
  } catch {
    return null;
  }
}

function syncImageForProduct(product: Product): string | null {
  if (product.imageUrl) return product.imageUrl;
  const asin = extractAsin(product.buyUrl);
  if (asin) return amazonAsinImageUrl(asin);
  return null;
}

/**
 * Fill missing thumbnails: ASIN → Amazon image widget, else Openverse search by title.
 * Never throws — recommendations must still return if image lookup fails.
 */
export async function enrichProductImages<T extends { product: Product }>(items: T[]): Promise<T[]> {
  const out: T[] = [];
  for (const item of items) {
    const sync = syncImageForProduct(item.product);
    if (sync) {
      out.push({ ...item, product: { ...item.product, imageUrl: sync } });
      continue;
    }
    const remote = await openverseImage(`${item.product.title} ${item.product.category}`);
    out.push({
      ...item,
      product: { ...item.product, imageUrl: remote },
    });
  }
  return out;
}

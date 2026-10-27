import { amazonAsinUrl } from "../affiliates/amazon";
import { isPlaceholderAmazonTitle, resolveAsinTitles } from "../catalog/asin-title.server";
import { amazonAsinImageUrl } from "../catalog/product-images";
import { amazonCatalog } from "../catalog/amazon-catalog";
import { setAmazonTitleSearch } from "../catalog/resolve-live.server";
import { engineConfig } from "../config";
import { genderSearchCue, normalizeAudience } from "../features/fit";
import type { AgeGroup, Product, Slot } from "../types";
import { engineLog, engineWarn } from "../utils/logger";
import type { StoreProduct, StoreSearchAdapter, StoreSearchRequest } from "./types";
import { storeProductToProduct } from "./types";

/** Let the product validator resolve search-URL / dead-ASIN gifts via Amazon crawl. */
setAmazonTitleSearch(async (phrase, limit, ageGroup) => {
  const hits = await searchAmazonHtml(phrase, limit, ageGroup);
  return hits.map((h) => ({ externalId: h.externalId, title: h.title, price: h.price }));
});

function avoidedHit(blob: string): boolean {
  return engineConfig.avoidCategories.some((cat) =>
    cat.terms.some((t) => blob.includes(t.toLowerCase())),
  );
}

function decodeAttr(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull a usable title from a search-result card chunk. */
function titleFromCard(chunk: string, asin: string): string | null {
  const patterns = [
    /class="[^"]*a-size-(?:base|medium|mini)[^"]*a-color-base[^"]*a-text-normal[^"]*"[^>]*>\s*([^<]{8,200})/i,
    /<h2[^>]*>[\s\S]{0,400}?<span[^>]*>\s*([^<]{8,200})\s*<\/span>/i,
    /alt="([^"]{10,200})"/i,
    /aria-label="([^"]{10,200})"/i,
  ];
  for (const re of patterns) {
    const m = chunk.match(re);
    if (!m?.[1]) continue;
    const title = decodeAttr(m[1]);
    if (!isPlaceholderAmazonTitle(title, asin)) return title.slice(0, 140);
  }
  return null;
}

function priceFromCard(chunk: string): number {
  const m = chunk.match(/class="a-price-whole"[^>]*>\s*([^<]+)/i);
  if (!m?.[1]) return NaN;
  return Number(String(m[1]).replace(/[^\d.]/g, ""));
}

/**
 * Fetch Amazon search HTML and extract live ASINs + titles.
 * Placeholder titles are filled from PDP when possible (product kept either way).
 */
async function searchAmazonHtml(phrase: string, limit: number, ageGroup: AgeGroup): Promise<StoreProduct[]> {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", phrase);
  if (engineConfig.amazon.partnerTag) url.searchParams.set("tag", engineConfig.amazon.partnerTag);

  let html = "";
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BUYTHIS/1.0",
      },
    });
    if (!res.ok) {
      engineWarn(`engine: Amazon HTML search HTTP ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (err) {
    engineWarn("engine: Amazon HTML search failed", err);
    return [];
  }

  const seen = new Set<string>();
  const out: StoreProduct[] = [];

  // Split into result cards by data-asin for more reliable title extraction.
  const cardStarts = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/gi)];
  for (let i = 0; i < cardStarts.length && out.length < limit; i++) {
    const asin = cardStarts[i]![1]!.toUpperCase();
    if (!asin || seen.has(asin)) continue;
    const start = cardStarts[i]!.index ?? 0;
    const end = i + 1 < cardStarts.length ? (cardStarts[i + 1]!.index ?? start + 3500) : start + 3500;
    const chunk = html.slice(start, Math.min(end, start + 4000));
    if (!/s-result-item|a-section|puis-|sg-col/i.test(chunk) && chunk.length < 200) continue;

    const title = titleFromCard(chunk, asin) || `Amazon pick ${asin}`;
    if (avoidedHit(title.toLowerCase())) continue;
    seen.add(asin);

    let audience = normalizeAudience(title);
    if (ageGroup === "child" || ageGroup === "teen") {
      if (audience === "unknown") audience = "kids";
    }

    const priceWhole = priceFromCard(chunk);
    const price = Number.isFinite(priceWhole) && priceWhole > 0 ? priceWhole : estimatePrice(title, ageGroup);
    out.push({
      storeId: "amazon",
      externalId: asin,
      title: title.slice(0, 140),
      description: `Amazon search match for “${phrase.slice(0, 60)}”.`,
      category: guessCategory(title),
      price,
      currency: "USD",
      imageUrl: amazonAsinImageUrl(asin, 300),
      buyUrl: amazonAsinUrl(asin),
      giftType: "physical",
      ageGroups: [ageGroup],
      tags: phraseTokens(phrase).slice(0, 8),
      audience,
    });
  }

  // Fallback: ASINs without titles — still keep, resolve titles next.
  if (out.length < Math.min(3, limit)) {
    for (const am of html.matchAll(/data-asin="([A-Z0-9]{10})"/g)) {
      const asin = am[1]!.toUpperCase();
      if (seen.has(asin)) continue;
      seen.add(asin);
      out.push({
        storeId: "amazon",
        externalId: asin,
        title: `Amazon pick ${asin}`,
        description: `Amazon search result for “${phrase.slice(0, 60)}”.`,
        category: "Gift",
        price: estimatePrice(phrase, ageGroup),
        currency: "USD",
        imageUrl: amazonAsinImageUrl(asin, 300),
        buyUrl: amazonAsinUrl(asin),
        giftType: "physical",
        ageGroups: [ageGroup],
        tags: phraseTokens(phrase).slice(0, 6),
        audience: ageGroup === "child" || ageGroup === "teen" ? "kids" : "unisex",
      });
      if (out.length >= limit) break;
    }
  }

  // Fill real titles for placeholders / badge junk — never drop the product.
  const needTitles = out.filter((p) => isPlaceholderAmazonTitle(p.title, p.externalId)).map((p) => p.externalId);
  if (needTitles.length) {
    const titles = await resolveAsinTitles(needTitles, 4);
    for (const p of out) {
      const real = titles.get(p.externalId.toUpperCase());
      if (real) {
        p.title = real.slice(0, 140);
        p.category = guessCategory(real);
        p.audience = normalizeAudience(real);
        if ((ageGroup === "child" || ageGroup === "teen") && p.audience === "unknown") p.audience = "kids";
      }
    }
    engineLog(`engine: resolved ${titles.size}/${needTitles.length} Amazon titles from PDP`);
  }

  // Bot / empty pages — signal clearly so catalog + title-resolve can recover.
  if (!out.length) {
    if (BOT_WALL_HINT.test(html) || html.length < 8_000) {
      engineWarn(`engine: Amazon HTML search blocked or empty for “${phrase.slice(0, 40)}”`);
    }
  }
  engineLog(`engine: Amazon HTML search “${phrase.slice(0, 50)}” → ${out.length} ASINs`);
  return out;
}

const BOT_WALL_HINT = /not a robot|enter the characters|api-services-support@amazon|sorry.*something went wrong/i;

/** Public title→ASIN crawl used by live product resolve. */
export async function searchAmazonByTitle(
  title: string,
  ageGroup: AgeGroup,
  limit = 6,
): Promise<StoreProduct[]> {
  return searchAmazonHtml(title, limit, ageGroup);
}

function phraseTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|under|ages?|with|from)$/.test(w));
}

function guessCategory(title: string): string {
  const t = title.toLowerCase();
  if (/toy|lego|play|doll|car pack/.test(t)) return "Toys";
  if (/book|kindle|novel/.test(t)) return "Books";
  if (/headphone|speaker|earbuds|echo|tech/.test(t)) return "Tech";
  if (/cook|kitchen|blender|pot/.test(t)) return "Kitchen";
  if (/beauty|hair|skin|makeup/.test(t)) return "Beauty";
  return "Gift";
}

function estimatePrice(text: string, ageGroup: AgeGroup): number {
  if (ageGroup === "child") return 18;
  if (/premium|pro|deluxe/.test(text.toLowerCase())) return 79;
  return 35;
}

function toStoreFromCatalog(p: (typeof amazonCatalog)[number]): StoreProduct {
  const asin = extractAsinFromBuyUrl(p.buyUrl) || p.id.replace(/^amz-/, "").toUpperCase().slice(0, 10);
  return {
    storeId: "amazon",
    externalId: asin || p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency,
    imageUrl: p.imageUrl,
    buyUrl: p.buyUrl,
    giftType: p.giftType,
    ageGroups: p.ageGroups,
    tags: p.tags,
    audience: p.audience,
  };
}

function extractAsinFromBuyUrl(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m?.[1]?.toUpperCase() ?? null;
}

/** Score curated catalog products against a search phrase (always available offline). */
function searchCatalogPhrase(req: StoreSearchRequest, limit: number): StoreProduct[] {
  const tokens = phraseTokens(req.phrase);
  const occasionTokens = phraseTokens([req.occasion, req.relationship, ...(req.interests ?? []), req.vibe]
    .filter(Boolean)
    .join(" "));
  const pool = amazonCatalog
    .filter((p) => p.ageGroups.includes(req.ageGroup))
    .filter((p) => !avoidedHit(`${p.title} ${p.tags.join(" ")}`.toLowerCase()))
    .filter((p) => {
      if (req.maxPriceUsd != null && p.price > req.maxPriceUsd) return false;
      if (req.minPriceUsd != null && req.minPriceUsd > 0 && p.price < req.minPriceUsd * 0.7) return false;
      return true;
    });

  const scored = pool
    .map((p) => {
      const blob = `${p.title} ${p.description} ${p.tags.join(" ")} ${(p.occasions || []).join(" ")} ${(p.parentTypes || []).join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of tokens) if (blob.includes(t)) score += 2;
      for (const t of occasionTokens) if (blob.includes(t)) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
    .slice(0, limit);

  if (scored.length) {
    engineLog(`engine: curated catalog fill ${scored.length} for “${req.phrase.slice(0, 40)}”`);
    return scored.map(({ p }) => toStoreFromCatalog(p));
  }

  // Amazon HTML blocked + no phrase overlap — still return budget-fit curated gifts
  // so live/local never ends with an empty slot (better than random book junk later).
  const fallback = pool.slice(0, limit).map(toStoreFromCatalog);
  if (fallback.length) {
    engineWarn(
      `engine: curated catalog soft-fill ${fallback.length} (no phrase match; Amazon may be blocked)`,
      req.phrase.slice(0, 40),
    );
  }
  return fallback;
}

/** Optional PA-API hook — enable when keys are approved. */
async function searchViaPaapi(_req: StoreSearchRequest): Promise<StoreProduct[] | null> {
  const { accessKey, secretKey } = engineConfig.amazon.paapi;
  if (!accessKey || !secretKey) return null;
  engineWarn("engine: Amazon PA-API keys present but adapter not wired yet — using HTML/catalog search");
  return null;
}

export type SlotSearchSpec = {
  slot: Slot;
  phrase: string;
  angle?: string;
};

let lastBatchTip: string | null = null;
export function takeLastBatchTip(): string | null {
  const t = lastBatchTip;
  lastBatchTip = null;
  return t;
}

/**
 * Search all slots without Claude: Amazon HTML (parallel) + catalog fill.
 */
export async function searchAmazonAllSlots(input: {
  slots: SlotSearchSpec[];
  maxPriceUsd: number | null;
  minPriceUsd: number | null;
  ageGroup: AgeGroup;
  ageRange?: string;
  gender?: StoreSearchRequest["gender"];
  relationship?: string;
  occasion?: string;
  interests?: string[];
  vibe?: string;
  perSlotLimit?: number;
}): Promise<Map<Slot, StoreProduct[]>> {
  const perSlot = Math.min(8, Math.max(3, input.perSlotLimit ?? 5));
  const who = genderSearchCue(input.ageGroup, input.gender ?? "unspecified");
  engineLog("engine: gift brain searching Amazon (no Claude)", who || "unisex");

  lastBatchTip =
    "Dominique matched these to their answers — a short handwritten note makes any of them feel more personal.";

  const bySlot = new Map<Slot, StoreProduct[]>();
  const globalSeen = new Set<string>();

  let amazonHtmlHits = 0;
  let amazonHtmlBlocked = 0;

  await Promise.all(
    input.slots.map(async (slot) => {
      const req: StoreSearchRequest = {
        phrase: slot.phrase,
        maxPriceUsd: input.maxPriceUsd,
        minPriceUsd: input.minPriceUsd,
        ageGroup: input.ageGroup,
        limit: perSlot,
        ...(input.gender ? { gender: input.gender } : {}),
        ...(input.interests?.length ? { interests: input.interests } : {}),
        ...(input.ageRange ? { ageRange: input.ageRange } : {}),
        ...(input.relationship ? { relationship: input.relationship } : {}),
        ...(input.occasion ? { occasion: input.occasion } : {}),
        ...(input.vibe ? { vibe: input.vibe } : {}),
      };

      const paapi = await searchViaPaapi(req);
      let hits = paapi?.length ? paapi : await searchAmazonHtml(slot.phrase, perSlot, input.ageGroup);
      if (!paapi?.length) {
        if (hits.length) amazonHtmlHits += hits.length;
        else amazonHtmlBlocked += 1;
      }

      // Always merge curated when HTML is thin — critical on corp proxies / bot walls.
      if (hits.length < 3) {
        const catalogHits = searchCatalogPhrase(req, perSlot);
        hits = [...hits, ...catalogHits];
      }

      const deduped: StoreProduct[] = [];
      for (const h of hits) {
        const id = h.externalId.toUpperCase();
        if (globalSeen.has(id)) continue;
        if (input.maxPriceUsd != null && h.price > input.maxPriceUsd) continue;
        globalSeen.add(id);
        deduped.push(h);
        if (deduped.length >= perSlot) break;
      }
      bySlot.set(slot.slot, deduped);
      engineLog(`engine: found ${deduped.length} raw products for ${slot.slot}`);
    }),
  );

  if (amazonHtmlBlocked > 0 && amazonHtmlHits === 0) {
    engineWarn(
      `engine: Amazon HTML blocked for all ${amazonHtmlBlocked} slot searches — using curated /dp catalog only. On live (non-proxy) Amazon crawl usually works; check browser console for this warn.`,
    );
  } else if (amazonHtmlBlocked > 0) {
    engineWarn(
      `engine: Amazon HTML partial block (${amazonHtmlBlocked} empty slots, ${amazonHtmlHits} live ASINs) — curated fill mixed in`,
    );
  } else {
    engineLog(`engine: Amazon HTML ok — ${amazonHtmlHits} live ASINs across slots`);
  }

  for (const s of input.slots) {
    if (!bySlot.has(s.slot)) bySlot.set(s.slot, []);
  }
  return bySlot;
}

export const amazonSearchAdapter: StoreSearchAdapter = {
  id: "amazon",
  label: "Amazon",
  async search(req) {
    if (!engineConfig.amazon.enabled) return [];
    const paapi = await searchViaPaapi(req);
    if (paapi?.length) return paapi;
    const html = await searchAmazonHtml(req.phrase, req.limit ?? 6, req.ageGroup);
    if (html.length) return html;
    return searchCatalogPhrase(req, req.limit ?? 6);
  },
};

/** Expose catalog products as Product[] for memory fast-path merges. */
export function catalogProductsAsList(): Product[] {
  return amazonCatalog.map((p) => ({ ...p }));
}

export { storeProductToProduct };

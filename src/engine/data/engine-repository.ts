import { getEngineDb } from "./server-db";

import { amazonCatalog } from "../catalog/amazon-catalog";
import { starterCatalog } from "../catalog/starter-catalog";
import { amazonAsinUrl, withAmazonTag } from "../affiliates/amazon";
import { extractAsin } from "../catalog/product-images";
import { isAmazonPdpUrl, isAmazonSearchUrl } from "../catalog/product-validator";
import { engineConfig } from "../config";
import { normalizeAudience } from "../features/fit";
import type { Product, ProductStats, Recommendation } from "../types";
import { engineWarn } from "../utils/logger";

/** Compact historical winners for Gift Brain memory / logs. */
export type SegmentInsight = {
  productId: string;
  title: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
};

function tagAmazonProducts(products: Product[]): Product[] {
  return products
    .map((p) => {
      const asin = extractAsin(p.buyUrl);
      if (asin && (isAmazonPdpUrl(p.buyUrl) || isAmazonSearchUrl(p.buyUrl))) {
        return {
          ...p,
          buyUrl: amazonAsinUrl(asin),
          provider: "amazon" as const,
        };
      }
      if (!p.buyUrl || isAmazonSearchUrl(p.buyUrl)) {
        return null;
      }
      return {
        ...p,
        buyUrl: withAmazonTag(p.buyUrl),
        provider: p.provider === "starter" ? ("amazon" as const) : p.provider,
      };
    })
    .filter((p): p is Product => p != null);
}

function fallbackCatalog(): Product[] {
  if (engineConfig.amazon.enabled && engineConfig.amazon.partnerTag) {
    return tagAmazonProducts(amazonCatalog);
  }
  return tagAmazonProducts(starterCatalog);
}

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  tags: string[] | null;
  age_groups: string[] | null;
  gift_type: string;
  attributes: Record<string, unknown> | null;
  image_url: string | null;
  buy_url: string;
  provider: string;
  popularity: number;
  occasion?: string[] | null;
  price_tier?: string | null;
  relationship?: string[] | null;
  parent_type?: string[] | null;
  wear_use_do?: string | null;
};

function untyped() {
  return getEngineDb() as unknown as { from: (t: string) => any; rpc: (fn: string, args?: object) => any };
}

let productCache: { at: number; products: Product[] } | null = null;

/** Clear in-memory catalog cache (admin import / sync). */
export function invalidateProductCache() {
  productCache = null;
}

function genderToAudience(g: string): Product["audience"] {
  const v = (g || "").trim().toUpperCase();
  if (v === "W" || v === "WOMEN" || v === "F" || v === "FEMALE") return "women";
  if (v === "M" || v === "MEN" || v === "MALE") return "men";
  if (v === "K" || v === "KIDS" || v === "CHILD") return "kids";
  if (v === "U" || v === "UNISEX" || v === "") return "unisex";
  return normalizeAudience(g);
}

function agesToGroups(start: number | null, end: number | null): Product["ageGroups"] {
  const a = start ?? 0;
  const b = end ?? 99;
  const groups: Product["ageGroups"] = [];
  if (a <= 12 && b >= 0) groups.push("child");
  if (a <= 17 && b >= 13) groups.push("teen");
  if (b >= 18) groups.push("adult");
  return groups.length ? groups : ["adult"];
}

function giftCatalogToProduct(r: {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  price_tier: string | null;
  tags: string[] | null;
  gender: string;
  age_start: number | null;
  age_end: number | null;
  occasion: string;
  relationship: string;
  buy_url: string;
  asin: string | null;
  slot: string;
  gift_note: string;
  retailer: string;
}): Product {
  const asin = r.asin || extractAsin(r.buy_url);
  const buyUrl = asin
    ? amazonAsinUrl(asin)
    : r.buy_url
      ? withAmazonTag(r.buy_url)
      : "";
  const occasions = r.occasion
    ? r.occasion.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const relationships = r.relationship
    ? r.relationship.split(/[,|;]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    id: `gc:${r.sku || r.id}`,
    title: r.title,
    description: r.description || r.gift_note || "",
    category: r.category || "Other",
    price: Number(r.price) || 0,
    currency: "USD",
    tags: [...(r.tags ?? []), ...(r.slot ? [r.slot] : [])],
    ageGroups: agesToGroups(r.age_start, r.age_end),
    giftType: "physical",
    audience: genderToAudience(r.gender),
    imageUrl: null,
    buyUrl,
    provider: (r.retailer || "catalog").toLowerCase().includes("amazon") ? "amazon" : "gift_catalog",
    popularity: 0.5,
    occasions,
    priceTier: (r.price_tier as Product["priceTier"]) || "",
    relationships,
    parentTypes: [],
    wearUseDo: "",
  };
}

async function loadGiftCatalogProducts(): Promise<Product[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await untyped()
    .from("gift_catalog")
    .select("*")
    .eq("is_dead", false)
    .neq("status", "dead")
    .limit(5000);
  if (error) {
    engineWarn("engine: gift_catalog unavailable", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<Parameters<typeof giftCatalogToProduct>[0] & {
    available_from: string | null;
    available_to: string | null;
    status: string;
  }>;
  return rows
    .filter((r) => {
      if (r.available_from && r.available_from > today) return false;
      if (r.available_to && r.available_to < today) return false;
      return true;
    })
    .map(giftCatalogToProduct)
    .filter((p) => p.title && (p.buyUrl || p.provider === "gift_catalog"));
}

/** Catalog + DB products for scoring / Gift Brain memory. */
export async function loadProducts(): Promise<Product[]> {
  if (productCache && Date.now() - productCache.at < 60_000) return productCache.products;

  const giftCatalog = await loadGiftCatalogProducts();
  const preferLocal = engineConfig.catalogMode === "local";
  const skipAmazon = engineConfig.catalogMode === "local";

  const { data, error } = await untyped().from("products").select("*").eq("active", true).limit(2000);
  let products: Product[] = [];
  if (error || !data?.length) {
    if (error) engineWarn("engine: products table unavailable, using Amazon/starter fallback", error.message);
    products = preferLocal && giftCatalog.length ? [] : fallbackCatalog();
  } else {
    products = (data as ProductRow[]).map(rowToProduct).map((p) => ({
      ...p,
      buyUrl: withAmazonTag(p.buyUrl),
    }));
  }

  // Prefer Excel gift_catalog over starter/search-URL junk; merge Amazon when allowed.
  const byId = new Map(products.map((p) => [p.id, p]));
  const byTitle = new Map(products.map((p) => [p.title.trim().toLowerCase(), p] as const));

  for (const p of giftCatalog) {
    byId.set(p.id, p);
    byTitle.set(p.title.trim().toLowerCase(), p);
  }

  if (!skipAmazon && engineConfig.amazon.enabled) {
    for (const p of tagAmazonProducts(amazonCatalog)) {
      const key = p.title.trim().toLowerCase();
      const existing = byTitle.get(key);
      // Don't replace a live gift_catalog row with amazon search junk
      if (existing?.provider === "gift_catalog" || existing?.id.startsWith("gc:")) {
        continue;
      }
      byId.set(p.id, p);
      if (!existing || isAmazonSearchUrl(existing.buyUrl) || !extractAsin(existing.buyUrl)) {
        byTitle.set(key, p);
        if (existing && existing.id !== p.id) byId.delete(existing.id);
        byId.set(p.id, p);
      }
    }
  }

  // If catalog mode is amazon-only, drop non-amazon providers except gift_catalog when both
  let merged = [...byId.values()];
  if (engineConfig.catalogMode === "amazon") {
    merged = merged.filter((p) => p.provider === "amazon" || p.id.startsWith("gc:"));
  } else if (engineConfig.catalogMode === "local") {
    merged = giftCatalog.length ? giftCatalog : merged.filter((p) => p.id.startsWith("gc:") || p.provider === "gift_catalog");
    if (!merged.length) merged = fallbackCatalog();
  }

  productCache = { at: Date.now(), products: merged };
  return merged;
}

function rowToProduct(r: ProductRow): Product {
  const tags = r.tags ?? [];
  const attrAudience = normalizeAudience(
    typeof r.attributes?.["audience"] === "string" ? String(r.attributes["audience"]) : "",
  );
  const audience =
    attrAudience !== "unknown"
      ? attrAudience
      : normalizeAudience(`${r.title} ${r.description ?? ""} ${tags.join(" ")}`);
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category ?? "Other",
    price: Number(r.price),
    currency: r.currency,
    tags,
    ageGroups: (r.age_groups ?? ["adult"]) as Product["ageGroups"],
    giftType: r.gift_type as Product["giftType"],
    audience,
    imageUrl: r.image_url,
    buyUrl: r.buy_url,
    provider: r.provider,
    popularity: r.popularity,
    occasions: r.occasion ?? [],
    priceTier: (r.price_tier as Product["priceTier"]) || "",
    relationships: r.relationship ?? [],
    parentTypes: r.parent_type ?? [],
    wearUseDo: (r.wear_use_do as Product["wearUseDo"]) || "",
  };
}

/** Persist Gift Brain picks so later clicks train segment stats. */
export async function upsertSuggestedProducts(items: Recommendation[]) {
  if (!items.length) return;
  const rows = items.map(({ product: p }) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    price: p.price,
    currency: p.currency,
    tags: p.tags,
    age_groups: p.ageGroups,
    gift_type: p.giftType,
    attributes: { audience: p.audience || "unknown" },
    image_url: p.imageUrl,
    buy_url: p.buyUrl,
    product_url: p.buyUrl,
    provider: p.provider || "amazon",
    popularity: p.popularity,
    active: true,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await untyped().from("products").upsert(rows, { onConflict: "id" });
  if (error) engineWarn("engine: could not upsert suggested products", error.message);
  else productCache = null;
}

/** Learned stats for a segment plus global stats ("*"). */
export async function loadStats(segment: string): Promise<Map<string, ProductStats[]>> {
  const map = new Map<string, ProductStats[]>();
  const { data, error } = await untyped().from("product_segment_stats").select("*").in("segment", [segment, "*"]);
  if (error) return map;
  for (const r of data as { product_id: string; segment: string; impressions: number; clicks: number }[]) {
    const list = map.get(r.product_id) ?? [];
    const k = r.segment === "*" ? 1 : 2;
    list.push({ productId: r.product_id, segment: r.segment, impressions: r.impressions * k, clicks: r.clicks * k });
    map.set(r.product_id, list);
  }
  return map;
}

/**
 * Compact historical winners for Gift Brain memory (segment first, then global).
 * Safe when tables are missing — returns [].
 */
export async function loadSegmentInsights(segment: string): Promise<SegmentInsight[]> {
  const { data, error } = await untyped()
    .from("product_segment_stats")
    .select("product_id, impressions, clicks")
    .in("segment", [segment, "*"])
    .order("clicks", { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];

  const aggregated = new Map<string, { impressions: number; clicks: number }>();
  for (const r of data as { product_id: string; impressions: number; clicks: number }[]) {
    const cur = aggregated.get(r.product_id) ?? { impressions: 0, clicks: 0 };
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    aggregated.set(r.product_id, cur);
  }

  const ids = [...aggregated.keys()].slice(0, 12);
  const { data: products } = await untyped().from("products").select("id, title").in("id", ids);
  const titles = new Map((products as { id: string; title: string }[] | null)?.map((p) => [p.id, p.title]) ?? []);

  return [...aggregated.entries()]
    .map(([productId, s]) => ({
      productId,
      title: titles.get(productId) ?? null,
      impressions: s.impressions,
      clicks: s.clicks,
      ctr: s.impressions > 0 ? s.clicks / s.impressions : 0,
    }))
    .sort((a, b) => b.ctr - a.ctr || b.clicks - a.clicks)
    .slice(0, 8);
}

export async function activeModelVersion(): Promise<string> {
  const { data } = await untyped()
    .from("model_versions")
    .select("version")
    .eq("status", "active")
    .order("trained_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.version as string | undefined) ?? "cold-start";
}

export async function saveRecommendations(row: {
  id: string;
  segment: string;
  searchId: string | null;
  sessionId: string | null;
  modelVersion: string;
  strategy: string;
  items: { productId: string; slot: string; rank: number; score: number; reason: string; breakdown: object }[];
}) {
  const { error } = await untyped().from("recommendations").insert(
    row.items.map((i) => ({
      recommendation_id: row.id,
      segment: row.segment,
      search_id: row.searchId,
      session_id: row.sessionId,
      product_id: i.productId,
      slot: i.slot,
      rank: i.rank,
      score: i.score,
      reason: i.reason,
      features: i.breakdown,
      model_version: row.modelVersion,
      strategy: row.strategy,
    })),
  );
  if (error) engineWarn("engine: could not log recommendations", error.message);
}

/** Fire-and-forget: the database decides whether training is due. */
export async function maybeTrain(minIntervalMinutes: number) {
  if (!engineConfig.trainingEnabled) return;
  const { error } = await untyped().rpc("engine_train", { min_interval_minutes: minIntervalMinutes });
  if (error) engineWarn("engine: training skipped", error.message);
}

/** Optional cleanup of old interaction events (AI analytics only). */
export async function cleanupOldEvents(retentionDays = engineConfig.eventRetentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { error } = await untyped().from("interaction_events").delete().lt("created_at", cutoff);
  if (error) engineWarn("engine: event cleanup skipped", error.message);
}

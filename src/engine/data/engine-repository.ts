import { getEngineDb } from "./server-db";

import type { SegmentInsight } from "../ai/claude-suggest.server";
import { amazonCatalog } from "../catalog/amazon-catalog";
import { starterCatalog } from "../catalog/starter-catalog";
import { withAmazonTag } from "../affiliates/amazon";
import { engineConfig } from "../config";
import type { Product, ProductStats, Recommendation } from "../types";

function tagAmazonProducts(products: Product[]): Product[] {
  return products.map((p) => ({
    ...p,
    buyUrl: withAmazonTag(p.buyUrl),
    provider: p.provider === "starter" ? "amazon" : p.provider,
  }));
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
  image_url: string | null;
  buy_url: string;
  provider: string;
  popularity: number;
};

function untyped() {
  return getEngineDb() as unknown as { from: (t: string) => any; rpc: (fn: string, args?: object) => any };
}

let productCache: { at: number; products: Product[] } | null = null;

/** Emergency fallback catalog only — primary mode uses Claude suggestions. */
export async function loadProducts(): Promise<Product[]> {
  if (productCache && Date.now() - productCache.at < 60_000) return productCache.products;
  const { data, error } = await untyped().from("products").select("*").eq("active", true).limit(2000);
  if (error || !data?.length) {
    if (error) console.warn("engine: products table unavailable, using Amazon/starter fallback", error.message);
    const fallback = fallbackCatalog();
    productCache = { at: Date.now(), products: fallback };
    return fallback;
  }
  const products = (data as ProductRow[]).map(rowToProduct).map((p) => ({
    ...p,
    buyUrl: withAmazonTag(p.buyUrl),
  }));
  // Merge curated Amazon gifts so scoring can prefer shoppable Associates links.
  const byId = new Map(products.map((p) => [p.id, p]));
  if (engineConfig.amazon.enabled) {
    for (const p of tagAmazonProducts(amazonCatalog)) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
  }
  const merged = [...byId.values()];
  productCache = { at: Date.now(), products: merged };
  return merged;
}

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    category: r.category ?? "Other",
    price: Number(r.price),
    currency: r.currency,
    tags: r.tags ?? [],
    ageGroups: (r.age_groups ?? ["adult"]) as Product["ageGroups"],
    giftType: r.gift_type as Product["giftType"],
    imageUrl: r.image_url,
    buyUrl: r.buy_url,
    provider: r.provider,
    popularity: r.popularity,
  };
}

/** Persist Claude suggestions so later clicks can train segment stats. */
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
    image_url: p.imageUrl,
    buy_url: p.buyUrl,
    product_url: p.buyUrl,
    provider: p.provider || "claude",
    popularity: p.popularity,
    active: true,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await untyped().from("products").upsert(rows, { onConflict: "id" });
  if (error) console.warn("engine: could not upsert suggested products", error.message);
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
 * Compact historical winners for Claude's prompt (segment first, then global).
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
  if (error) console.warn("engine: could not log recommendations", error.message);
}

/** Fire-and-forget: the database decides whether training is due. */
export async function maybeTrain(minIntervalMinutes: number) {
  if (!engineConfig.trainingEnabled) return;
  const { error } = await untyped().rpc("engine_train", { min_interval_minutes: minIntervalMinutes });
  if (error) console.warn("engine: training skipped", error.message);
}

/** Optional cleanup of old interaction events (AI analytics only). */
export async function cleanupOldEvents(retentionDays = engineConfig.eventRetentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { error } = await untyped().from("interaction_events").delete().lt("created_at", cutoff);
  if (error) console.warn("engine: event cleanup skipped", error.message);
}

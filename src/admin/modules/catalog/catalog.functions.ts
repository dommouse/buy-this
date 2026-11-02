import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { fetchAsinProductTitle } from "@/engine/catalog/asin-title.server";
import { extractAsin } from "@/engine/catalog/product-images";
import {
  isAmazonSearchUrl,
  isValidAsinFormat,
  probeAsin,
} from "@/engine/catalog/product-validator";
import { getEngineDb } from "@/engine/data/server-db";
import { invalidateProductCache } from "@/engine/data/engine-repository";

/** Amazon product URLs with tracking params routinely exceed 1k chars. */
const LONG_URL_MAX = 4000;

const buyUrlSchema = z
  .string()
  .min(1, "Buy URL is required")
  .max(LONG_URL_MAX)
  .refine((v) => {
    try {
      const u = new URL(v.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Buy URL must be a valid http(s) link");

const catalogSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).default(""),
  retailer: z.string().max(80).default("Amazon"),
  price: z.number().nullable().optional(),
  price_tier: z.string().max(10).nullable().optional(),
  occasion: z.string().max(80).default(""),
  relationship: z.string().max(80).default(""),
  gender: z.string().max(10).default(""),
  age_start: z.number().int().nullable().optional(),
  age_end: z.number().int().nullable().optional(),
  tags: z.array(z.string()).default([]),
  slot: z.string().max(40).default(""),
  gift_note: z.string().max(2000).default(""),
  available_from: z.string().nullable().optional(),
  available_to: z.string().nullable().optional(),
  category: z.string().max(120).default(""),
  verification_note: z.string().max(2000).default(""),
  status: z.string().max(40).default("pending"),
  buy_url: buyUrlSchema,
  asin: z.string().max(20).nullable().optional(),
  external_ref: z.string().max(200).default(""),
  is_dead: z.boolean().optional(),
});

function titleTokenOverlap(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return hit / A.size;
}

function searchQueryFromUrl(url: string): string {
  try {
    return new URL(url).searchParams.get("k") || "";
  } catch {
    return "";
  }
}

async function evaluateBuyLink(
  title: string,
  buyUrl: string,
  asinHint: string | null,
): Promise<{ alive: boolean; reason: string; asin: string | null }> {
  const url = (buyUrl || "").trim();
  if (!url) return { alive: false, reason: "Missing buy URL", asin: null };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { alive: false, reason: "Invalid buy URL", asin: null };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { alive: false, reason: "Buy URL must be http(s)", asin: null };
  }

  const asin = (asinHint && isValidAsinFormat(asinHint) ? asinHint : null) || extractAsin(url);

  // Amazon product detail page — probe ASIN + title match
  if (asin) {
    const probe = await probeAsin(asin);
    if (probe === "dead") {
      return { alive: false, reason: `ASIN ${asin} is unavailable`, asin };
    }
    const liveTitle = await fetchAsinProductTitle(asin);
    if (liveTitle) {
      const overlap = titleTokenOverlap(title, liveTitle);
      if (overlap < 0.35) {
        return {
          alive: false,
          reason: `Link product title does not match catalog (“${liveTitle.slice(0, 80)}”)`,
          asin,
        };
      }
      return {
        alive: true,
        reason: probe === "unknown" ? "ASIN reachable; title matches (soft)" : "ASIN alive and title matches",
        asin,
      };
    }
    // Title fetch blocked — trust probe alive/unknown as live if URL is PDP
    if (probe === "alive" || probe === "unknown") {
      return { alive: true, reason: `ASIN ${asin} appears reachable`, asin };
    }
    return { alive: false, reason: `ASIN ${asin} could not be verified`, asin };
  }

  // Amazon search URL — require query to overlap catalog title
  if (isAmazonSearchUrl(url)) {
    const q = searchQueryFromUrl(url) || decodeURIComponent(url);
    const overlap = titleTokenOverlap(title, q);
    if (overlap < 0.4) {
      return {
        alive: false,
        reason: "Search link query does not match this product title",
        asin: null,
      };
    }
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(4_000),
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36 BUYTHIS/1.0",
        },
      });
      if (res.status === 404) {
        return { alive: false, reason: "Search link returned 404", asin: null };
      }
      return { alive: true, reason: "Search link matches title and is reachable", asin: null };
    } catch {
      // Network blocked — still accept title-matched search links
      return { alive: true, reason: "Search link matches title (reachability unknown)", asin: null };
    }
  }

  // Other retailers — basic reachability
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: "text/html,*/*", "User-Agent": "Mozilla/5.0 BUYTHIS/1.0" },
    });
    if (res.status >= 400) {
      return { alive: false, reason: `Buy URL returned HTTP ${res.status}`, asin: null };
    }
    return { alive: true, reason: "Buy URL is reachable", asin: null };
  } catch {
    return { alive: false, reason: "Buy URL could not be reached", asin: null };
  }
}

export const listGiftCatalog = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        q: z.string().max(100).optional(),
        status: z.string().max(40).optional(),
        dead: z.enum(["all", "live", "dead"]).optional(),
        occasion: z.string().max(80).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = getEngineDb().from("gift_catalog").select("*").order("updated_at", { ascending: false }).limit(1000);
    if (data?.q?.trim()) {
      const term = `%${data.q.trim()}%`;
      q = q.or(`sku.ilike.${term},title.ilike.${term},category.ilike.${term}`);
    }
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.dead === "live") q = q.eq("is_dead", false);
    if (data?.dead === "dead") q = q.eq("is_dead", true);
    if (data?.occasion?.trim()) q = q.ilike("occasion", `%${data.occasion.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertGiftCatalogItem = createServerFn({ method: "POST" })
  .validator((data) => catalogSchema.parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const db = getEngineDb();
    const sku = data.sku.trim();

    const { data: skuOwner, error: skuError } = await db
      .from("gift_catalog")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();
    if (skuError) throw new Error(skuError.message);
    if (skuOwner && skuOwner.id !== data.id) {
      throw new Error(`SKU "${sku}" is already used by another product`);
    }

    const payload = {
      ...data,
      sku,
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };
    delete (payload as { id?: string }).id;
    if (data.id) {
      const { data: row, error } = await db
        .from("gift_catalog")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          throw new Error(`SKU "${sku}" is already used by another product`);
        }
        throw new Error(error.message);
      }
      await audit(actor.id, "update", "gift_catalog", data.id);
      invalidateProductCache();
      return row;
    }
    const { data: row, error } = await db.from("gift_catalog").insert(payload).select("*").single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new Error(`SKU "${sku}" is already used by another product`);
      }
      throw new Error(error.message);
    }
    await audit(actor.id, "create", "gift_catalog", row.id);
    invalidateProductCache();
    return row;
  });

export const deleteGiftCatalogItem = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb().from("gift_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "gift_catalog", data.id);
    invalidateProductCache();
    return { ok: true };
  });

export const clearDeadCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await requireAdmin();
  const { error, count } = await getEngineDb()
    .from("gift_catalog")
    .delete({ count: "exact" })
    .eq("is_dead", true);
  if (error) throw new Error(error.message);
  await audit(actor.id, "clear_dead", "gift_catalog", null, { deleted: count ?? 0 });
  invalidateProductCache();
  return { deleted: count ?? 0 };
});

export const markCatalogDead = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid(), is_dead: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await getEngineDb()
      .from("gift_catalog")
      .update({
        is_dead: data.is_dead,
        status: data.is_dead ? "dead" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    invalidateProductCache();
    return { ok: true };
  });

export const importGiftCatalogRows = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        rows: z.array(catalogSchema.omit({ id: true })).min(1).max(500),
        finalize: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const db = getEngineDb();
    const now = new Date().toISOString();
    const errors: string[] = [];

    // Deduplicate SKUs within this import batch (keep first occurrence)
    const seenInBatch = new Set<string>();
    const uniqueRows: typeof data.rows = [];
    for (const row of data.rows) {
      const sku = row.sku.trim();
      if (seenInBatch.has(sku)) {
        errors.push(`${sku}: duplicate SKU in import file (skipped)`);
        continue;
      }
      seenInBatch.add(sku);
      uniqueRows.push({ ...row, sku });
    }

    const skus = uniqueRows.map((r) => r.sku);
    const { data: existingRows, error: lookupError } = await db
      .from("gift_catalog")
      .select("sku")
      .in("sku", skus);
    if (lookupError) throw new Error(lookupError.message);
    const existing = new Set((existingRows ?? []).map((r) => r.sku as string));

    // Skip SKUs already in the catalog — never overwrite on auto-import
    const toInsert = uniqueRows.filter((row) => {
      if (existing.has(row.sku)) {
        errors.push(`${row.sku}: SKU already exists (skipped)`);
        return false;
      }
      return true;
    });

    const payloads = toInsert.map((row) => ({
      ...row,
      updated_at: now,
      last_synced_at: now,
    }));

    let created = 0;
    const skippedExisting = uniqueRows.length - toInsert.length;

    if (payloads.length) {
      const { error: insertError } = await db.from("gift_catalog").insert(payloads);
      if (insertError) {
        // Fall back to smaller batches
        const subSize = 25;
        for (let i = 0; i < payloads.length; i += subSize) {
          const slice = payloads.slice(i, i + subSize);
          const { error } = await db.from("gift_catalog").insert(slice);
          if (error) {
            for (const row of slice) {
              if (/duplicate|unique/i.test(error.message)) {
                errors.push(`${row.sku}: SKU already exists (skipped)`);
              } else {
                errors.push(`${row.sku}: ${error.message}`);
              }
            }
            continue;
          }
          created += slice.length;
        }
      } else {
        created = payloads.length;
      }
    }

    await audit(actor.id, "import", "gift_catalog", null, {
      created,
      skipped: skippedExisting + (errors.length - skippedExisting),
      errors: errors.length,
    });
    if (data.finalize) invalidateProductCache();
    return {
      created,
      updated: 0,
      skipped: Math.max(0, data.rows.length - created),
      errors: errors.slice(0, 50),
    };
  });

export const exportGiftCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await getEngineDb().from("gift_catalog").select("*").order("sku");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const syncCatalogToBrain = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await requireAdmin();
  invalidateProductCache();
  await audit(actor.id, "sync", "gift_catalog", null);
  return { ok: true };
});

export const validateCatalogBuyLink = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = getEngineDb();
    const { data: row, error } = await db.from("gift_catalog").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error(error?.message || "Catalog item not found");

    const result = await evaluateBuyLink(
      String(row.title || ""),
      String(row.buy_url || ""),
      row.asin ? String(row.asin) : null,
    );

    const { error: updateError } = await db
      .from("gift_catalog")
      .update({
        is_dead: !result.alive,
        status: result.alive ? (row.status === "dead" ? "pending" : row.status) : "dead",
        asin: result.asin || row.asin,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    invalidateProductCache();
    return {
      id: data.id,
      sku: row.sku as string,
      alive: result.alive,
      reason: result.reason,
      is_dead: !result.alive,
    };
  });

export const validateCatalogBuyLinksBatch = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = getEngineDb();
    const { data: rows, error } = await db.from("gift_catalog").select("*").in("id", data.ids);
    if (error) throw new Error(error.message);

    let alive = 0;
    let dead = 0;
    const details: { id: string; sku: string; alive: boolean; reason: string }[] = [];

    for (const row of rows ?? []) {
      const result = await evaluateBuyLink(
        String(row.title || ""),
        String(row.buy_url || ""),
        row.asin ? String(row.asin) : null,
      );
      const { error: updateError } = await db
        .from("gift_catalog")
        .update({
          is_dead: !result.alive,
          status: result.alive ? (row.status === "dead" ? "pending" : row.status) : "dead",
          asin: result.asin || row.asin,
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (updateError) {
        details.push({
          id: row.id as string,
          sku: String(row.sku),
          alive: false,
          reason: updateError.message,
        });
        dead += 1;
        continue;
      }
      if (result.alive) alive += 1;
      else dead += 1;
      details.push({
        id: row.id as string,
        sku: String(row.sku),
        alive: result.alive,
        reason: result.reason,
      });
    }

    invalidateProductCache();
    return { alive, dead, details };
  });

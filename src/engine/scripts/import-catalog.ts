/**
 * Upsert Dominique catalog batches into products.
 *
 * Usage:
 *   npx tsx src/engine/scripts/import-catalog.ts path/to/batch.csv
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getEngineDb } from "../data/server-db";

function splitList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|;,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function cell(r: Record<string, string>, key: string): string {
  return r[key] ?? "";
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx src/engine/scripts/import-catalog.ts <file.csv>");
    process.exit(1);
  }
  const text = readFileSync(resolve(file), "utf8");
  const rows = parseCsv(text);
  const db = getEngineDb() as unknown as { from: (t: string) => any };

  const payload = rows.map((r) => {
    const asin = cell(r, "asin") || cell(r, "external_id");
    const id = cell(r, "id") || (asin ? `amz-${asin.toLowerCase()}` : `imp-${Math.random().toString(36).slice(2, 10)}`);
    const buyUrl = cell(r, "buy_url") || cell(r, "product_url") || (asin ? `https://www.amazon.com/dp/${asin}` : "");
    return {
      id,
      external_id: asin || null,
      title: cell(r, "title") || id,
      description: cell(r, "description") || "",
      category: cell(r, "category") || "Other",
      price: Number(cell(r, "price")) || 0,
      currency: "USD",
      tags: splitList(cell(r, "tags")),
      age_groups: splitList(cell(r, "age_groups")).length ? splitList(cell(r, "age_groups")) : ["adult"],
      gift_type: cell(r, "gift_type") || "physical",
      image_url: cell(r, "image_url") || null,
      buy_url: buyUrl,
      product_url: buyUrl,
      provider: cell(r, "provider") || "curated",
      occasion: splitList(cell(r, "occasion") || cell(r, "occasions")),
      price_tier: cell(r, "price_tier") || null,
      relationship: splitList(cell(r, "relationship") || cell(r, "relationships")),
      parent_type: splitList(cell(r, "parent_type") || cell(r, "parent_types")),
      wear_use_do: cell(r, "wear_use_do") || null,
      active: true,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await db.from("products").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("import failed", error);
    process.exit(1);
  }
  console.log(`Imported ${payload.length} products from ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

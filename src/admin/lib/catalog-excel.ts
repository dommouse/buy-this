import * as XLSX from "xlsx";

export type CatalogImportRow = {
  sku: string;
  title: string;
  description: string;
  retailer: string;
  price: number | null;
  price_tier: string | null;
  occasion: string;
  relationship: string;
  gender: string;
  age_start: number | null;
  age_end: number | null;
  tags: string[];
  slot: string;
  gift_note: string;
  available_from: string | null;
  available_to: string | null;
  category: string;
  verification_note: string;
  status: string;
  buy_url: string;
  asin: string | null;
  external_ref: string;
  is_dead: boolean;
};

const KNOWN_SLOTS = new Set(
  ["the one", "the wow", "the wildcard", "the smart pick"].map((s) => s.toLowerCase()),
);

function normHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellByHeaders(row: Record<string, unknown>, ...keys: string[]): string {
  const wanted = keys.map((k) => k.toLowerCase());
  for (const [h, v] of Object.entries(row)) {
    const nh = normHeader(h);
    if (wanted.includes(nh) && v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

/** Prefer exact header match; fall back to positional empty-column aliases used by xlsx. */
function cellFlexible(row: Record<string, unknown>, keys: string[], emptyAliases: string[] = []): string {
  const direct = cellByHeaders(row, ...keys);
  if (direct) return direct;
  for (const alias of emptyAliases) {
    if (row[alias] != null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }
  return "";
}

function num(v: string): number | null {
  if (!v) return null;
  const ageMatch = v.match(/age\s*(\d+)/i);
  if (ageMatch) return Number(ageMatch[1]);
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function excelDate(v: string): string | null {
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + serial * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** True when string looks like a usable buy link. */
export function isProperBuyUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function amazonSearchUrlFromTitle(title: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(title.trim())}`;
}

/**
 * Pull a URL out of an Excel HYPERLINK(...) formula.
 * Handles patterns like:
 *   HYPERLINK("https://www.amazon.com/s?k="&ENCODEURL(B2),"Find on Amazon")
 */
function extractUrlFromHyperlinkFormula(formula: string, title: string): string | null {
  const f = formula.trim();
  if (!/HYPERLINK/i.test(f)) return null;

  // Full quoted URL inside HYPERLINK("https://...", ...)
  const full = f.match(/HYPERLINK\s*\(\s*"((?:https?:\/\/)[^"]+)"/i);
  if (full?.[1] && isProperBuyUrl(full[1])) {
    const url = full[1];
    // Incomplete search base like https://www.amazon.com/s?k= with concat after
    if (/\/s\?k=$/i.test(url) || /\/s\?k=(?=$)/i.test(url)) {
      return title ? amazonSearchUrlFromTitle(title) : null;
    }
    return url;
  }

  // Amazon search constructor with ENCODEURL / SUBSTITUTE of the gift title
  if (/amazon\.com\/s\?k=/i.test(f) && title) {
    return amazonSearchUrlFromTitle(title);
  }

  return null;
}

type SheetCell = XLSX.CellObject & {
  l?: { Target?: string; Rel?: { Target?: string } };
};

/** Map 0-based sheet row index → hyperlink target URL. */
function collectRowHyperlinks(sheet: XLSX.WorkSheet): Map<number, string> {
  const map = new Map<number, string>();
  if (!sheet["!ref"]) return map;
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[addr] as SheetCell | undefined;
      if (!cell) continue;

      const target = cell.l?.Target || cell.l?.Rel?.Target;
      if (typeof target === "string" && isProperBuyUrl(target)) {
        map.set(R, target.trim());
        continue;
      }

      if (typeof cell.f === "string" && /HYPERLINK/i.test(cell.f) && !map.has(R)) {
        // Title unknown at this pass — stash formula marker via incomplete extract
        const fromFormula = extractUrlFromHyperlinkFormula(cell.f, "");
        if (fromFormula) map.set(R, fromFormula);
        else if (/amazon\.com\/s\?k=/i.test(cell.f)) map.set(R, "__AMAZON_SEARCH_FROM_TITLE__");
      }
    }
  }
  return map;
}

function resolveAsinAndUrl(
  buy: string,
  asinCell: string,
  title: string,
): { buy_url: string; asin: string | null; external_ref: string } {
  const asinFromCell = asinCell.match(/\b([A-Z0-9]{10})\b/i)?.[1]?.toUpperCase() ?? null;
  const asinFromBuy = buy.match(/(?:\/(?:dp|gp\/product)\/)([A-Z0-9]{10})\b/i)?.[1]?.toUpperCase() ?? null;
  const asin = asinFromCell || asinFromBuy;

  // Prefer canonical PDP when we have an ASIN
  if (asin) {
    return {
      buy_url: `https://www.amazon.com/dp/${asin}`,
      asin,
      external_ref: buy || asin,
    };
  }

  if (buy === "__AMAZON_SEARCH_FROM_TITLE__" && title) {
    const url = amazonSearchUrlFromTitle(title);
    return { buy_url: url, asin: null, external_ref: "Find on Amazon" };
  }

  if (isProperBuyUrl(buy)) {
    return { buy_url: buy.trim(), asin: null, external_ref: buy.trim() };
  }

  // Display text only — reconstruct search URL from gift title when Amazon sheet pattern
  if (/^find on amazon$/i.test(buy) && title) {
    return {
      buy_url: amazonSearchUrlFromTitle(title),
      asin: null,
      external_ref: "Find on Amazon",
    };
  }

  return { buy_url: "", asin: null, external_ref: buy };
}

function isPlausibleSlot(s: string): boolean {
  if (!s || s.length > 40) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  if (/^find on amazon$/i.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return false;
  return true;
}

function pickSlot(row: Record<string, unknown>): string {
  const candidates = [
    cellFlexible(row, ["slot", "Slot", "gift type", "Gift Type", "type", "Type"], ["__EMPTY_2"]),
  ];
  for (const c of candidates) {
    if (c && KNOWN_SLOTS.has(c.toLowerCase())) return c.slice(0, 40);
    if (isPlausibleSlot(c)) return c;
  }
  for (const v of Object.values(row)) {
    const s = String(v ?? "").trim();
    if (s && KNOWN_SLOTS.has(s.toLowerCase())) return s;
  }
  return "";
}

function pickGiftNote(row: Record<string, unknown>): string {
  const note = cellFlexible(row, [
    "gift note",
    "Gift Note",
    "gift tip",
    "Gift Tip",
    "note",
    "gift note text",
  ]);
  if (note) return note.slice(0, 2000);
  return "";
}

function mapRow(row: Record<string, unknown>, hyperlinkHint: string): CatalogImportRow | null {
  const sku = cellFlexible(row, ["ID number", "id number", "ID", "id", "sku"]);
  const title = cellFlexible(row, ["gift", "Gift", "title", "Product Name", "product name"]);
  if (!sku || !title) return null;

  const buyRaw =
    hyperlinkHint ||
    cellFlexible(
      row,
      ["Find on Amazon", "Amazon Link", "amazon link", "buy_url", "buy url", "url", "link", "asin url"],
      ["__EMPTY_6"],
    );

  // If raw cell is formula text, try extract
  let buy = buyRaw;
  if (buy && /HYPERLINK/i.test(buy)) {
    buy = extractUrlFromHyperlinkFormula(buy, title) || buy;
  }

  const asinCell = cellFlexible(row, ["ASIN", "asin"]);
  const { buy_url, asin, external_ref } = resolveAsinAndUrl(buy, asinCell, title);

  const status = cellFlexible(row, ["status", "Status"], ["__EMPTY_5"]) || "pending";
  const ageStartRaw = cellFlexible(row, ["age start", "age_start", "Age Start", "Age"]);
  const ageEndRaw = cellFlexible(row, ["age end", "age_end", "Age End"]);

  return {
    sku: sku.slice(0, 80),
    title: title.slice(0, 300),
    description: cellFlexible(row, ["Description", "description", "desription"]).slice(0, 5000),
    retailer: cellFlexible(row, ["retailer", "Retailer"]) || "Amazon",
    price: num(cellFlexible(row, ["Price", "price", "Approx Price", "approx price"])),
    price_tier: cellFlexible(row, ["Price Tier", "price tier", "price_tier"]) || null,
    occasion: cellFlexible(row, ["occation", "occasion", "Occasion"]).slice(0, 80),
    relationship: cellFlexible(row, [
      "Gifter",
      "gifter",
      "relationship",
      "Relationship",
      "person buying",
    ]).slice(0, 80),
    gender: cellFlexible(row, ["gender", "Gender"]).slice(0, 10),
    age_start: num(ageStartRaw),
    age_end: num(ageEndRaw) ?? num(ageStartRaw),
    tags: parseTags(cellFlexible(row, ["tags", "Tags"])),
    slot: pickSlot(row).slice(0, 40),
    gift_note: pickGiftNote(row),
    available_from: excelDate(cellFlexible(row, ["available_from", "start", "from"], ["__EMPTY_3"])),
    available_to: excelDate(cellFlexible(row, ["available_to", "end", "to"], ["__EMPTY_4"])),
    category: cellFlexible(row, [
      "Category",
      "category",
      "type of gift",
      "Gift Type",
      "Home Type",
    ]).slice(0, 120),
    verification_note: cellFlexible(row, [
      "Verification Note",
      "verification note",
      "verification_note",
    ]).slice(0, 2000),
    status: status.slice(0, 40),
    buy_url: buy_url.slice(0, 4000),
    asin,
    external_ref: external_ref.slice(0, 200),
    is_dead: /dead/i.test(status),
  };
}

export type ParseCatalogResult = {
  rows: CatalogImportRow[];
  skippedNoBuyUrl: number;
};

/** Parse uploaded workbook into catalog rows (all sheets). Rows without a proper buy URL are skipped. */
export function parseCatalogWorkbook(buf: ArrayBuffer): CatalogImportRow[] {
  return parseCatalogWorkbookDetailed(buf).rows;
}

export function parseCatalogWorkbookDetailed(buf: ArrayBuffer): ParseCatalogResult {
  const wb = XLSX.read(buf, { type: "array", cellFormula: true, cellHTML: false });
  const out: CatalogImportRow[] = [];
  const seen = new Set<string>();
  let skippedNoBuyUrl = 0;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet?.["!ref"]) continue;

    const hyperlinks = collectRowHyperlinks(sheet);
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const headerRow = range.s.r;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    json.forEach((row, i) => {
      const excelRow = headerRow + 1 + i;
      let hint = hyperlinks.get(excelRow) || "";
      const mapped = mapRow(row, hint);
      if (!mapped) return;

      // Resolve placeholder search links after title is known
      if (mapped.buy_url === "" && (hint === "__AMAZON_SEARCH_FROM_TITLE__" || /^find on amazon$/i.test(hint))) {
        mapped.buy_url = amazonSearchUrlFromTitle(mapped.title);
        mapped.external_ref = "Find on Amazon";
      } else if (hint === "__AMAZON_SEARCH_FROM_TITLE__" && !isProperBuyUrl(mapped.buy_url)) {
        mapped.buy_url = amazonSearchUrlFromTitle(mapped.title);
      }

      if (!isProperBuyUrl(mapped.buy_url)) {
        skippedNoBuyUrl += 1;
        return;
      }

      if (seen.has(mapped.sku)) {
        const idx = out.findIndex((r) => r.sku === mapped.sku);
        if (idx >= 0) out[idx] = mapped;
        return;
      }
      seen.add(mapped.sku);
      out.push(mapped);
    });
  }

  return { rows: out, skippedNoBuyUrl };
}

export function catalogRowsToWorkbook(rows: Record<string, unknown>[]): ArrayBuffer {
  const mapped = rows.map((r) => ({
    "ID number": r["sku"],
    gift: r["title"],
    Description: r["description"],
    retailer: r["retailer"],
    Price: r["price"],
    "Price Tier": r["price_tier"],
    occation: r["occasion"],
    Gifter: r["relationship"],
    gender: r["gender"],
    "age start": r["age_start"],
    "age end": r["age_end"],
    tags: Array.isArray(r["tags"]) ? (r["tags"] as string[]).join(", ") : r["tags"],
    slot: r["slot"],
    "gift note": r["gift_note"],
    available_from: r["available_from"],
    available_to: r["available_to"],
    Category: r["category"],
    "Verification Note": r["verification_note"],
    status: r["status"],
    "Find on Amazon": r["buy_url"] || r["asin"] || r["external_ref"],
  }));
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Catalog");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

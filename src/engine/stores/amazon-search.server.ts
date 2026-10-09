import { callClaude, extractJsonObject } from "../ai/claude-client.server";
import { amazonAsinUrl } from "../affiliates/amazon";
import { amazonAsinImageUrl } from "../catalog/product-images";
import { engineConfig } from "../config";
import type { GiftType, Slot } from "../types";
import { engineLog, engineWarn } from "../utils/logger";
import type { StoreProduct, StoreSearchAdapter, StoreSearchRequest } from "./types";

function avoidedCategoryRule(): string {
  const labels = engineConfig.avoidCategories.map((c) => c.label).join(", ");
  return `NEVER return these gift types (too common): ${labels}. `;
}

function parseProductRow(
  row: {
    title?: string;
    description?: string;
    category?: string;
    price?: number;
    asin?: string;
    giftType?: string;
    tags?: string[];
  },
  req: Pick<StoreSearchRequest, "maxPriceUsd" | "minPriceUsd" | "ageGroup" | "gender" | "excludeIds">,
  seen: Set<string>,
): StoreProduct | null {
  const asin = String(row.asin ?? "")
    .trim()
    .toUpperCase();
  const exclude = new Set((req.excludeIds || []).map((id) => id.toUpperCase()));
  if (!/^[A-Z0-9]{10}$/.test(asin) || seen.has(asin) || exclude.has(asin)) return null;
  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) return null;
  if (req.maxPriceUsd != null && price > req.maxPriceUsd) return null;
  if (req.minPriceUsd != null && req.minPriceUsd > 0 && price < req.minPriceUsd * 0.7) return null;
  seen.add(asin);
  const giftType: GiftType =
    row.giftType === "experience" || row.giftType === "giftcard" || row.giftType === "physical"
      ? row.giftType
      : "physical";
  const tags = Array.isArray(row.tags) ? row.tags.map(String).slice(0, 12) : [];
  if (req.gender && req.gender !== "unspecified" && !tags.some((t) => /women|men|unisex|gender/i.test(t))) {
    tags.push(req.gender === "woman" ? "women" : req.gender === "man" ? "men" : "unisex");
  }
  return {
    storeId: "amazon",
    externalId: asin,
    title: String(row.title ?? "Amazon gift").slice(0, 120),
    description: String(row.description ?? "").slice(0, 400),
    category: String(row.category ?? "Gift").slice(0, 80),
    price,
    currency: "USD",
    imageUrl: amazonAsinImageUrl(asin, 300),
    buyUrl: amazonAsinUrl(asin),
    giftType,
    ageGroups: [req.ageGroup],
    tags,
  };
}

/**
 * Amazon store adapter.
 *
 * When AMAZON_PAAPI_* keys are configured, swap `searchViaPaapi` in.
 * Until then we resolve the keyword phrase to live /dp/ASIN candidates via Claude
 * — the keyword engine stays store-agnostic either way.
 */
async function searchViaClaudePhrase(req: StoreSearchRequest): Promise<StoreProduct[]> {
  const limit = Math.min(8, Math.max(4, req.limit ?? 6));
  const genderRule =
    req.gender && req.gender !== "unspecified" && req.gender !== "nonbinary"
      ? `GENDER BOUND: recipient is a ${req.gender}. Prefer products clearly suitable for a ${req.gender}. ` +
        `Do NOT return products aimed only at the opposite gender. Unisex is fine.`
      : "GENDER: not specified — prefer unisex / gender-neutral gifts.";

  const system =
    "You resolve gift SEARCH PHRASES into real currently-buyable Amazon.com products. " +
    "Return ONLY products that match the phrase AND the questionnaire bounds (age, budget, gender). " +
    "HARD RULE: every item needs a real live Amazon ASIN (10 chars). " +
    "BUY links must be product detail pages (/dp/ASIN), never /s? search pages. " +
    `BUDGET: price must be at or under maxUsd when set. Prefer mid-band of [minUsd, maxUsd]. ` +
    `AGE: products must suit ageGroup/ageRange — no baby items for adults, no adult items for children. ` +
    `${genderRule} ` +
    avoidedCategoryRule() +
    `Return up to ${limit} DISTINCT products with DIFFERENT ASINs. ` +
    (req.excludeIds?.length
      ? `NEVER reuse these ASINs (already used): ${req.excludeIds.join(", ")}. `
      : "") +
    "Tag products with gender cues when relevant (e.g. women, men, unisex) in tags. " +
    "Return ONLY JSON: {\"products\":[{\"title\":\"...\",\"description\":\"max 40 words\",\"category\":\"...\",\"price\":number,\"asin\":\"B0XXXXXXXX\",\"giftType\":\"physical|experience|giftcard\",\"tags\":[\"...\"]}]}.";

  const prompt = JSON.stringify({
    searchPhrase: req.phrase,
    bounds: {
      budget: { minUsd: req.minPriceUsd, maxUsd: req.maxPriceUsd },
      ageGroup: req.ageGroup,
      ageRange: req.ageRange || null,
      gender: req.gender || "unspecified",
      relationship: req.relationship || null,
      occasion: req.occasion || null,
      interests: req.interests || [],
      vibe: req.vibe || null,
    },
    excludeAsins: req.excludeIds || [],
    marketplace: engineConfig.amazon.marketplace,
  });

  const text = await callClaude(system, prompt, 25_000);
  const raw = extractJsonObject(text);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as {
    products?: {
      title?: string;
      description?: string;
      category?: string;
      price?: number;
      asin?: string;
      giftType?: string;
      tags?: string[];
    }[];
  };

  const out: StoreProduct[] = [];
  const seen = new Set<string>();
  for (const row of parsed.products ?? []) {
    const product = parseProductRow(row, req, seen);
    if (!product) continue;
    out.push(product);
    if (out.length >= limit) break;
  }
  return out;
}

export type SlotSearchSpec = {
  slot: Slot;
  phrase: string;
  angle?: string;
};

/**
 * ONE Claude call resolves products for all 4 gift slots — much faster than 4 sequential searches.
 */
export async function searchAmazonAllSlots(input: {
  slots: SlotSearchSpec[];
  maxPriceUsd: number | null;
  minPriceUsd: number | null;
  ageGroup: StoreSearchRequest["ageGroup"];
  ageRange?: string;
  gender?: StoreSearchRequest["gender"];
  relationship?: string;
  occasion?: string;
  interests?: string[];
  vibe?: string;
  perSlotLimit?: number;
}): Promise<Map<Slot, StoreProduct[]>> {
  const perSlot = Math.min(6, Math.max(3, input.perSlotLimit ?? 4));
  const genderRule =
    input.gender && input.gender !== "unspecified" && input.gender !== "nonbinary"
      ? `GENDER: recipient is a ${input.gender}. Prefer suitable gifts; no opposite-gender-only items.`
      : "GENDER: not specified — prefer unisex.";

  engineLog("engine: batch searching all slots in one call");

  const system =
    "You resolve gift SEARCH PHRASES into real currently-buyable Amazon.com products for MULTIPLE gift slots. " +
    "HARD RULE: every item needs a real live Amazon ASIN (10 chars) and /dp/ASIN only (never /s?). " +
    `For EACH slot return up to ${perSlot} DISTINCT products. ASINs must be unique across ALL slots. ` +
    `BUDGET max when set; prefer mid-band. AGE must match. ${genderRule} ` +
    avoidedCategoryRule() +
    "Return ONLY JSON: " +
    '{"tip":"max 28 words presentation tip","slots":[{"slot":"The One|The Wow|The Smart Pick|The Wildcard","products":[{"title":"...","description":"max 30 words","category":"...","price":number,"asin":"B0XXXXXXXX","giftType":"physical|experience|giftcard","tags":["..."]}]}]}';

  const prompt = JSON.stringify({
    bounds: {
      budget: { minUsd: input.minPriceUsd, maxUsd: input.maxPriceUsd },
      ageGroup: input.ageGroup,
      ageRange: input.ageRange || null,
      gender: input.gender || "unspecified",
      relationship: input.relationship || null,
      occasion: input.occasion || null,
      interests: input.interests || [],
      vibe: input.vibe || null,
    },
    slots: input.slots,
    marketplace: engineConfig.amazon.marketplace,
  });

  const text = await callClaude(system, prompt, 35_000);
  const raw = extractJsonObject(text);
  const bySlot = new Map<Slot, StoreProduct[]>();
  for (const s of input.slots) bySlot.set(s.slot, []);
  if (!raw) return bySlot;

  const parsed = JSON.parse(raw) as {
    tip?: string;
    slots?: {
      slot?: string;
      products?: {
        title?: string;
        description?: string;
        category?: string;
        price?: number;
        asin?: string;
        giftType?: string;
        tags?: string[];
      }[];
    }[];
  };

  const seen = new Set<string>();
  const reqBase: Pick<StoreSearchRequest, "maxPriceUsd" | "minPriceUsd" | "ageGroup" | "excludeIds"> &
    Partial<Pick<StoreSearchRequest, "gender">> = {
    maxPriceUsd: input.maxPriceUsd,
    minPriceUsd: input.minPriceUsd,
    ageGroup: input.ageGroup,
    excludeIds: [],
    ...(input.gender ? { gender: input.gender } : {}),
  };

  for (const row of parsed.slots ?? []) {
    const slot = input.slots.find((s) => s.slot === row.slot)?.slot;
    if (!slot) continue;
    const list = bySlot.get(slot) ?? [];
    for (const p of row.products ?? []) {
      const product = parseProductRow(p, reqBase, seen);
      if (!product) continue;
      list.push(product);
      if (list.length >= perSlot) break;
    }
    bySlot.set(slot, list);
    engineLog(`engine: found ${list.length} raw products for ${slot}`);
  }

  // Stash tip on a well-known symbol for the caller (module-level one-shot).
  lastBatchTip = typeof parsed.tip === "string" ? parsed.tip.slice(0, 260) : null;
  return bySlot;
}

let lastBatchTip: string | null = null;
export function takeLastBatchTip(): string | null {
  const t = lastBatchTip;
  lastBatchTip = null;
  return t;
}

/** Placeholder for Product Advertising API — enable when keys are approved. */
async function searchViaPaapi(_req: StoreSearchRequest): Promise<StoreProduct[] | null> {
  const { accessKey, secretKey } = engineConfig.amazon.paapi;
  if (!accessKey || !secretKey) return null;
  engineWarn("engine: Amazon PA-API keys present but adapter not wired yet — using phrase resolver");
  return null;
}

export const amazonSearchAdapter: StoreSearchAdapter = {
  id: "amazon",
  label: "Amazon",
  async search(req) {
    if (!engineConfig.amazon.enabled) return [];
    const paapi = await searchViaPaapi(req);
    if (paapi?.length) return paapi;
    return searchViaClaudePhrase(req);
  },
};

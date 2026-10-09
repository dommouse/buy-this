import { callClaude, extractJsonObject } from "../ai/claude-client.server";
import { amazonAsinUrl } from "../affiliates/amazon";
import { amazonAsinImageUrl } from "../catalog/product-images";
import { engineConfig } from "../config";
import type { GiftType } from "../types";
import { engineWarn } from "../utils/logger";
import type { StoreProduct, StoreSearchAdapter, StoreSearchRequest } from "./types";

function avoidedCategoryRule(): string {
  const labels = engineConfig.avoidCategories.map((c) => c.label).join(", ");
  return `NEVER return these gift types (too common): ${labels}. `;
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

  const text = await callClaude(system, prompt, 40_000);
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

  const exclude = new Set((req.excludeIds || []).map((id) => id.toUpperCase()));
  const out: StoreProduct[] = [];
  const seen = new Set<string>();
  for (const row of parsed.products ?? []) {
    const asin = String(row.asin ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin) || seen.has(asin) || exclude.has(asin)) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) continue;
    if (req.maxPriceUsd != null && price > req.maxPriceUsd) continue;
    if (req.minPriceUsd != null && req.minPriceUsd > 0 && price < req.minPriceUsd * 0.7) continue;
    seen.add(asin);
    const giftType: GiftType =
      row.giftType === "experience" || row.giftType === "giftcard" || row.giftType === "physical"
        ? row.giftType
        : "physical";
    const tags = Array.isArray(row.tags) ? row.tags.map(String).slice(0, 12) : [];
    if (req.gender && req.gender !== "unspecified" && !tags.some((t) => /women|men|unisex|gender/i.test(t))) {
      tags.push(req.gender === "woman" ? "women" : req.gender === "man" ? "men" : "unisex");
    }
    out.push({
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
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Placeholder for Product Advertising API — enable when keys are approved. */
async function searchViaPaapi(_req: StoreSearchRequest): Promise<StoreProduct[] | null> {
  const { accessKey, secretKey } = engineConfig.amazon.paapi;
  if (!accessKey || !secretKey) return null;
  // PA-API signed search can replace Claude resolution later without touching the keyword engine.
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

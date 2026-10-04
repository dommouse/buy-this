import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { isAmazonUrl, merchantSearchUrl, toBuyUrl } from "../affiliates/links";
import { engineConfig } from "../config";
import type { AgeGroup, GiftType, Product, RecipientProfile, Recommendation } from "../types";
import type { ProfileFeatures } from "../features/profile";

export class AiUnavailableError extends Error {}

export type SegmentInsight = {
  productId: string;
  title: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type ClaudeSuggestResult = {
  tip: string | null;
  items: Recommendation[];
};

type ClaudeGift = {
  title: string;
  description: string;
  category: string;
  price: number;
  reason: string;
  tags?: string[];
  giftType?: GiftType;
  searchQuery?: string;
  merchantUrl?: string;
  imageUrl?: string | null;
  asin?: string | null;
};

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || `gift-${crypto.randomUUID().slice(0, 8)}`;
}

function budgetHint(budget: string): string {
  return budget ? `Stay within budget band: ${budget}.` : "Prefer thoughtful mid-range gifts.";
}

/**
 * Ask Claude for a dynamic set of gift ideas (count from ENGINE_RECOMMENDATION_COUNT).
 * Slots (The One / Wow / Smart Pick / Wildcard) are assigned later by the ranker.
 */
export async function claudeSuggestGifts(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  insights: SegmentInsight[];
  sessionId: string | null;
}): Promise<ClaudeSuggestResult | null> {
  const apiKey = engineConfig.anthropicApiKey;
  if (!engineConfig.useAi || !apiKey) return null;

  const count = Math.min(24, Math.max(4, engineConfig.recommendationCount));
  const anthropic = createAnthropic({ apiKey });

  const historyBlock =
    input.insights.length > 0
      ? {
          note: "Historical winners for similar shoppers (prefer similar vibes when they still fit; do not copy blindly).",
          winners: input.insights.slice(0, 8).map((w) => ({
            id: w.productId,
            title: w.title,
            ctr: Number(w.ctr.toFixed(3)),
            clicks: w.clicks,
            impressions: w.impressions,
          })),
        }
      : { note: "Cold start — no historical click data yet. Rely on questionnaire fit." };

  const amazonPreferred = engineConfig.amazon.enabled && !!engineConfig.amazon.partnerTag;
  const system =
    "You are Dominique, a warm witty gift concierge for BUY THIS / Relationship Concierge. " +
    `Invent exactly ${count} REALISTIC, buyable, DISTINCT gift ideas (physical products, experiences, or gift cards). ` +
    (amazonPreferred
      ? "Prefer gifts that are easy to buy on Amazon.com (searchable product names, popular brands, Amazon gift cards). " +
        "For physical products and gift cards, set searchQuery to a precise Amazon search phrase (brand + product type). " +
        "When you know a real Amazon ASIN, include it in asin. " +
        "Only use merchantUrl for non-Amazon experiences that truly cannot be fulfilled on Amazon. "
      : "Propose shoppable gifts with a searchQuery or merchantUrl. ") +
    "Respect age group, budget, interests, vibe, gift-type preference, and avoid notes. " +
    "Include a direct https imageUrl when you know a public product image; otherwise null. " +
    `Return ONLY JSON: {"tip":"max 30 words presentation tip","gifts":[{"title":"...","description":"max 40 words","category":"...","price":number,"reason":"max 25 words to the shopper","tags":["..."],"giftType":"physical|experience|giftcard","searchQuery":"...","merchantUrl":"optional https url","asin":"optional 10-char ASIN","imageUrl":null}]}. ` +
    `Exactly ${count} different gifts, varied across interests and price points within budget.`;

  const prompt = JSON.stringify({
    recipient: input.profile,
    derived: {
      ageGroup: input.features.ageGroup,
      budgetRange: input.features.budget,
      giftTypePreference: input.features.giftType,
      segment: input.features.segment,
      signals: input.features.signals,
      avoidWords: input.features.avoidWords,
    },
    shopping: {
      primaryStore: amazonPreferred ? "amazon" : "open-web",
      amazonPartnerTag: amazonPreferred ? engineConfig.amazon.partnerTag : null,
      count,
      note: amazonPreferred
        ? "BUY THIS links will open Amazon with our Associates store ID. Optimize for Amazon-findable gifts."
        : "BUY THIS links may use partner affiliate wrapping when configured.",
    },
    guidance: budgetHint(input.profile.budget),
    history: historyBlock,
  });

  let text: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), engineConfig.maxRecommendationMs);
    try {
      const result = await generateText({
        model: anthropic(engineConfig.claudeModel),
        system,
        prompt,
        maxRetries: 0,
        abortSignal: controller.signal,
      });
      text = result.text;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      throw new AiUnavailableError(`Claude returned ${status}`);
    }
    throw err;
  }

  return parseClaudeGifts(text, input.features.ageGroup, input.sessionId, count);
}

export function parseClaudeGifts(
  text: string,
  ageGroup: AgeGroup,
  sessionId: string | null,
  minCount = 4,
): ClaudeSuggestResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as { tip?: string; gifts?: ClaudeGift[] };
    if (!Array.isArray(raw.gifts) || raw.gifts.length < Math.min(4, minCount)) return null;

    const usedTitles = new Set<string>();
    const items: Recommendation[] = [];

    for (const g of raw.gifts) {
      if (!g?.title) continue;
      const titleKey = g.title.trim().toLowerCase();
      if (usedTitles.has(titleKey)) continue;
      usedTitles.add(titleKey);

      const giftType: GiftType =
        g.giftType === "experience" || g.giftType === "giftcard" || g.giftType === "physical"
          ? g.giftType
          : "physical";
      const price = Number(g.price);
      if (!Number.isFinite(price) || price < 0) continue;

      const preferAmazon = engineConfig.amazon.enabled && !!engineConfig.amazon.partnerTag;
      const explicitMerchant =
        typeof g.merchantUrl === "string" && g.merchantUrl.startsWith("http") ? g.merchantUrl : null;
      const asin = typeof g.asin === "string" && /^[A-Z0-9]{10}$/i.test(g.asin) ? g.asin.toUpperCase() : null;
      const asinUrl = asin ? `https://www.amazon.com/dp/${asin}` : null;

      const merchant =
        asinUrl ||
        (giftType === "experience" && explicitMerchant && !isAmazonUrl(explicitMerchant)
          ? explicitMerchant
          : preferAmazon || !explicitMerchant
            ? merchantSearchUrl(g.searchQuery || g.title)
            : explicitMerchant);

      const buyUrl = toBuyUrl(merchant, { customId: sessionId });
      const provider = isAmazonUrl(buyUrl) || preferAmazon ? "amazon" : "claude";
      const imageUrl =
        typeof g.imageUrl === "string" && g.imageUrl.startsWith("http")
          ? g.imageUrl
          : asin
            ? `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&MarketPlace=US&ASIN=${asin}&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=_SL300_`
            : null;

      const product: Product = {
        id: `claude-${slugify(g.title)}`,
        title: String(g.title).slice(0, 120),
        description: String(g.description ?? "").slice(0, 400),
        category: String(g.category || "Gift").slice(0, 80),
        price,
        currency: "USD",
        tags: Array.isArray(g.tags) ? g.tags.map(String).slice(0, 12) : [],
        ageGroups: [ageGroup],
        giftType,
        imageUrl,
        buyUrl,
        provider,
        popularity: 0,
      };

      items.push({
        slot: "The One", // replaced by ranker after merge/sort
        rank: items.length + 1,
        product,
        score: Number(Math.max(0.4, 0.95 - items.length * 0.03).toFixed(4)),
        reason: String(g.reason ?? "A strong match for them.").slice(0, 220),
      });

      if (items.length >= minCount) break;
    }

    if (items.length < Math.min(4, minCount)) return null;
    return {
      tip: typeof raw.tip === "string" ? raw.tip.slice(0, 260) : null,
      items,
    };
  } catch {
    return null;
  }
}

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { amazonAsinUrl } from "../affiliates/amazon";
import { isAmazonUrl, toBuyUrl } from "../affiliates/links";
import { amazonAsinImageUrl, extractAsin } from "../catalog/product-images";
import { isAmazonPdpUrl, validateRecommendations } from "../catalog/product-validator";
import { engineConfig } from "../config";
import type { ProfileFeatures } from "../features/profile";
import type { AgeGroup, GiftType, Product, RecipientProfile, Recommendation } from "../types";
import { engineWarn } from "../utils/logger";
import { isTlsCertError, recoverFromTlsError } from "../utils/tls";

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

function budgetBlock(features: ProfileFeatures, budgetLabel: string) {
  if (!features.budget) {
    return {
      label: budgetLabel || "flexible",
      minUsd: null,
      maxUsd: null,
      rule: "Prefer thoughtful mid-range gifts under $150 unless the recipient clearly warrants more.",
    };
  }
  const [minUsd, maxUsd] = features.budget;
  return {
    label: budgetLabel,
    minUsd,
    maxUsd,
    rule:
      `HARD RULE — price MAX $${maxUsd}: every gift price MUST be <= $${maxUsd} USD (never over). ` +
      `Price MIN $${minUsd} is soft: prefer staying near/above $${minUsd}, but a strong gift a bit under is OK. ` +
      `Never suggest anything over $${maxUsd}.`,
  };
}

function ageRule(features: ProfileFeatures, profile: { ageRange?: string; gender?: string }) {
  const range = features.ageRange || profile.ageRange || features.ageGroup;
  if (features.ageGroup === "child") {
    return `HARD RULE — AGE: recipient is a CHILD (age ${range}). Only child-safe, age-appropriate toys/books/gear for that exact age. No alcohol, adult beauty, or teen/adult tech unless clearly for kids.`;
  }
  if (features.ageGroup === "teen") {
    return `HARD RULE — AGE: recipient is a TEEN (age ${range}). Only teen-appropriate gifts. No toddler/infant products, no alcohol.`;
  }
  return `HARD RULE — AGE: recipient is an ADULT (age range: ${range || "adult"}). No infant/toddler toys unless the occasion is a baby shower.`;
}

function genderRule(features: ProfileFeatures, profile: { gender?: string }) {
  const g = (features.gender || profile.gender || "").toLowerCase();
  if (!g || g === "unspecified" || /prefer|rather|skip|non.?binary/.test(g)) {
    return "GENDER: not specified — prefer unisex / gender-neutral gifts.";
  }
  if (/woman|women|female|girl/.test(g) || features.gender === "woman") {
    return "HARD RULE — GENDER: recipient is a woman. Prefer gifts suitable for women. Do NOT return men-only products.";
  }
  if (/man|men|male|boy/.test(g) || features.gender === "man") {
    return "HARD RULE — GENDER: recipient is a man. Prefer gifts suitable for men. Do NOT return women-only products.";
  }
  return "GENDER: prefer unisex / gender-neutral gifts.";
}

function buildSystem(
  count: number,
  askExtra: number,
  amazonPreferred: boolean,
  budget: ReturnType<typeof budgetBlock>,
  features: ProfileFeatures,
  profile: { ageRange?: string; gender?: string },
) {
  const need = count + askExtra;
  return (
    "You are Dominique, gift brain for BUY THIS / Relationship Concierge. " +
    "Your job is to recommend REAL, currently buyable products that match the questionnaire exactly. " +
    `Return ${need} DISTINCT gift candidates (we will validate and keep the best ${count}). ` +
    `${budget.rule} ` +
    `${ageRule(features, profile)} ` +
    `${genderRule(features, profile)} ` +
    "Match recipient relationship, occasion, vibe, interests, wants, gift-type preference, and NEVER violate avoid notes. " +
    `NEVER suggest these avoided categories: ${engineConfig.avoidCategories.map((c) => c.label).join(", ")}. ` +
    "CRITICAL: all gifts must be DIFFERENT products — never repeat the same gift across the list. " +
    (amazonPreferred
      ? "HARD RULE for physical products and gift cards: you MUST provide a real live Amazon.com ASIN (10 chars). " +
        "BUY THIS opens ONLY amazon.com/dp/ASIN product pages — NEVER amazon.com/s? search pages. " +
        "Only famous in-stock products whose ASIN you are certain still exists. If unsure of the ASIN, pick a different famous product. " +
        "price must be a realistic current USD street price and MUST NOT exceed the budget max. " +
        "Experiences may omit asin and use a non-Amazon merchantUrl only when they cannot be bought on Amazon. "
      : "Provide a shoppable https merchantUrl for every gift. ") +
    "Do not invent random image URLs. Leave imageUrl null — we attach Amazon images when ASIN is verified. " +
    'Each reason MUST name a concrete questionnaire answer (interest, vibe, age, occasion, or relationship) — e.g. "Because they love Reading and this fits a birthday for ages 6-8." ' +
    `Return ONLY JSON: {"tip":"max 30 words","gifts":[{"title":"...","description":"max 40 words","category":"...","price":number,"reason":"Because they… (max 28 words, cite their answers)","tags":["interest or vibe from questionnaire"],"giftType":"physical|experience|giftcard","asin":"B0XXXXXXXX","searchQuery":"brand + product","merchantUrl":null}]}.`
  );
}

async function callClaudeOnce(system: string, prompt: string, signal: AbortSignal): Promise<string> {
  const anthropic = createAnthropic({ apiKey: engineConfig.anthropicApiKey });
  const result = await generateText({
    model: anthropic(engineConfig.claudeModel),
    system,
    prompt,
    maxRetries: 0,
    abortSignal: signal,
  });
  return result.text;
}

async function callClaude(system: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), engineConfig.maxRecommendationMs);
  try {
    try {
      return await callClaudeOnce(system, prompt, controller.signal);
    } catch (err) {
      // Corporate SSL MITM — auto-relax TLS once and retry so gift brain stays alive.
      if (recoverFromTlsError(err) && !controller.signal.aborted) {
        engineWarn("engine: retrying Claude after TLS relaxation");
        return await callClaudeOnce(system, prompt, controller.signal);
      }
      const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
      if (status === 401 || status === 402 || status === 403 || status === 429) {
        throw new AiUnavailableError(`Claude returned ${status}`);
      }
      if (isTlsCertError(err)) {
        throw new AiUnavailableError(
          "Claude TLS blocked (self-signed cert). Set ENGINE_TLS_INSECURE=true in local .env and restart.",
        );
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Questionnaire → Claude gift brain → validated Amazon PDP gifts.
 * Retries once if validation drops too many candidates.
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
  const amazonPreferred = engineConfig.amazon.enabled && !!engineConfig.amazon.partnerTag;
  const budget = budgetBlock(input.features, input.profile.budget);
  const askExtra = Math.min(8, Math.max(4, Math.ceil(count * 0.5)));

  const historyBlock =
    input.insights.length > 0
      ? {
          note: "Historical winners for similar shoppers — prefer similar vibes only when they still fit budget + answers.",
          winners: input.insights.slice(0, 8).map((w) => ({
            id: w.productId,
            title: w.title,
            ctr: Number(w.ctr.toFixed(3)),
            clicks: w.clicks,
          })),
        }
      : { note: "Cold start — rely only on questionnaire fit." };

  const basePrompt = {
    questionnaire: input.profile,
    derived: {
      ageGroup: input.features.ageGroup,
      ageRange: input.features.ageRange || input.profile.ageRange,
      budget,
      giftTypePreference: input.features.giftType,
      segment: input.features.segment,
      mustMatchSignals: input.features.signals,
      avoidWords: input.features.avoidWords,
    },
    shopping: {
      primaryStore: amazonPreferred ? "amazon.com" : "open-web",
      associateTag: amazonPreferred ? engineConfig.amazon.partnerTag : null,
      requireLiveAsinProductPage: true,
      buyThisMustBeDpAsin: true,
      neverUseAmazonSearchUrls: true,
      neverInventAsins: true,
      countNeeded: count,
      candidatesRequested: count + askExtra,
    },
    history: historyBlock,
  };

  const system = buildSystem(count, askExtra, amazonPreferred, budget, input.features, input.profile);
  let text = await callClaude(system, JSON.stringify(basePrompt));
  let parsed = parseClaudeGifts(text, input.features, input.sessionId, count + askExtra);
  let validated = parsed ? await validateRecommendations(parsed.items, { features: input.features, sessionId: input.sessionId }) : [];

  if (validated.length < Math.min(4, count)) {
    engineWarn(`engine: only ${validated.length} gifts passed validation — asking Claude for replacements`);
    const rejectNote = {
      ...basePrompt,
      retry: true,
      keepTitles: validated.map((v) => v.product.title),
      instruction:
        `Previous candidates failed live /dp/ASIN / age / budget-max checks. Return ${count + askExtra} NEW gifts. ` +
        `Price MUST be <= $${budget.maxUsd ?? 150}. Age must match ${input.features.ageRange || input.features.ageGroup}. ` +
        "Every physical/giftcard MUST include a different live Amazon ASIN (product page /dp/ only — no search URLs).",
    };
    text = await callClaude(system, JSON.stringify(rejectNote));
    parsed = parseClaudeGifts(text, input.features, input.sessionId, count + askExtra);
    const more = parsed ? await validateRecommendations(parsed.items, { features: input.features, sessionId: input.sessionId }) : [];
    const seen = new Set(validated.map((v) => v.product.title.toLowerCase()));
    for (const m of more) {
      const k = m.product.title.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      validated.push(m);
    }
  }

  if (validated.length < Math.min(4, count)) {
    engineWarn("engine: Claude gift brain could not produce enough validated gifts");
    return validated.length ? { tip: parsed?.tip ?? null, items: validated.slice(0, count) } : null;
  }

  return {
    tip: parsed?.tip ?? null,
    items: validated.slice(0, count),
  };
}

/** Parse Claude JSON into draft recommendations (not yet ASIN-validated). */
export function parseClaudeGifts(
  text: string,
  featuresOrAge: ProfileFeatures | AgeGroup,
  sessionId: string | null,
  minCount = 4,
): ClaudeSuggestResult | null {
  const ageGroup: AgeGroup = typeof featuresOrAge === "string" ? featuresOrAge : featuresOrAge.ageGroup;
  const budgetMax =
    typeof featuresOrAge === "string" ? null : featuresOrAge.budget ? featuresOrAge.budget[1] : null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as { tip?: string; gifts?: ClaudeGift[] };
    if (!Array.isArray(raw.gifts) || raw.gifts.length < Math.min(2, minCount)) return null;

    const usedTitles = new Set<string>();
    const items: Recommendation[] = [];
    const preferAmazon = engineConfig.amazon.enabled && !!engineConfig.amazon.partnerTag;

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

      // Drop over-max prices early (min is soft — allow through for validator).
      if (budgetMax != null && price > budgetMax) continue;

      const asinRaw = typeof g.asin === "string" ? g.asin.trim().toUpperCase() : "";
      const asin = /^[A-Z0-9]{10}$/.test(asinRaw) ? asinRaw : extractAsin(g.merchantUrl || "");
      const explicitMerchant =
        typeof g.merchantUrl === "string" && g.merchantUrl.startsWith("http") ? g.merchantUrl : null;

      let merchant: string | null = null;
      if (asin) {
        merchant = amazonAsinUrl(asin);
      } else if (giftType === "experience" && explicitMerchant && !isAmazonUrl(explicitMerchant)) {
        merchant = explicitMerchant;
      } else if (explicitMerchant && isAmazonPdpUrl(explicitMerchant)) {
        merchant = explicitMerchant;
      } else {
        // Physical / gift cards without a /dp/ASIN are skipped — no Amazon search fallback.
        continue;
      }

      const buyUrl = toBuyUrl(merchant, { customId: sessionId });
      const tags = Array.isArray(g.tags) ? g.tags.map(String).slice(0, 12) : [];
      const product: Product = {
        id: asin ? `amz-${asin.toLowerCase()}` : `claude-${slugify(g.title)}`,
        title: String(g.title).slice(0, 120),
        description: String(g.description ?? "").slice(0, 400),
        category: String(g.category || "Gift").slice(0, 80),
        price,
        currency: "USD",
        tags,
        ageGroups: [ageGroup],
        giftType,
        imageUrl: asin ? amazonAsinImageUrl(asin, 300) : null,
        buyUrl,
        provider: asin || preferAmazon ? "amazon" : "claude",
        popularity: 0,
      };

      items.push({
        slot: "The One",
        rank: items.length + 1,
        product,
        score: Number(Math.max(0.4, 0.95 - items.length * 0.03).toFixed(4)),
        reason: String(g.reason ?? "Because it matches their answers from the questionnaire.").slice(0, 220),
      });
    }

    if (!items.length) return null;
    return {
      tip: typeof raw.tip === "string" ? raw.tip.slice(0, 260) : null,
      items,
    };
  } catch {
    return null;
  }
}

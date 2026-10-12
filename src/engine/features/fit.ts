import { engineConfig } from "../config";
import type { ProfileFeatures } from "./profile";
import type { AgeGroup, GenderAudience, Product, ProductStats, RecipientProfile } from "../types";

function localBehaviorScore(stats: ProductStats[] | undefined) {
  if (!stats?.length) return { score: 0, confidence: 0 };
  const imp = stats.reduce((a, s) => a + s.impressions, 0);
  const clk = stats.reduce((a, s) => a + s.clicks, 0);
  const ctr = (clk + 1) / (imp + 10);
  return {
    score: Math.min(1, ctr * 4),
    confidence: Math.min(1, imp / engineConfig.behaviorConfidenceAt),
  };
}

/** Normalized gender from questionnaire (empty = not answered / prefer not to say). */
export type GenderFit = "woman" | "man" | "nonbinary" | "unspecified";

export function normalizeGender(raw: string | null | undefined): GenderFit {
  const g = (raw || "").trim().toLowerCase();
  if (!g || /prefer|rather|skip|n\/a|none|unknown|any|all/.test(g)) return "unspecified";
  if (/^(woman|women|female|girl|she|her)\b/.test(g) || g === "f") return "woman";
  if (/^(man|men|male|boy|he|him)\b/.test(g) || g === "m") return "man";
  if (/non.?binary|enby|gender.?fluid|they/.test(g)) return "nonbinary";
  if (/woman|female|girl/.test(g)) return "woman";
  if (/man|male|boy/.test(g)) return "man";
  return "unspecified";
}

/** Infer audience from explicit field, tags, or title/description cues. */
export function resolveAudience(product: Product): GenderAudience {
  if (product.audience && product.audience !== "unknown") return product.audience;

  const tags = product.tags.map((t) => t.toLowerCase());
  if (tags.some((t) => t === "audience:women" || t === "women" || t === "for women" || t === "ladies")) {
    return "women";
  }
  if (tags.some((t) => t === "audience:men" || t === "men" || t === "for men")) return "men";
  if (tags.some((t) => t === "audience:unisex" || t === "unisex" || t === "gender-neutral")) return "unisex";
  if (tags.some((t) => t === "audience:kids" || t === "kids" || t === "children")) return "kids";

  const blob = `${product.title} ${product.description} ${product.category}`.toLowerCase();
  if (/\bunisex\b|\ball genders\b|\bgender.?neutral\b|\bfor everyone\b/.test(blob)) return "unisex";

  const womenCue =
    /\b(women'?s|womens|for women|ladies|girl'?s|female|makeup|lipstick|mascara|skincare for her|hairbrush for women|nursing bra|menstrual|pads for women|eyeliner|foundation makeup|blush palette)\b/.test(
      blob,
    );
  const menCue =
    /\b(men'?s|mens|for men|boy'?s|male|beard oil|beard trimmer|men'?s grooming|men'?s razor|athletic cup|jockstrap)\b/.test(
      blob,
    );

  if (womenCue && !menCue) return "women";
  if (menCue && !womenCue) return "men";
  return "unknown";
}

/** Normalize AI / store audience strings into our enum. */
export function normalizeAudience(raw: string | null | undefined): GenderAudience {
  const a = (raw || "").trim().toLowerCase();
  if (!a) return "unknown";
  if (/women|woman|ladies|female|girl/.test(a)) return "women";
  if (/men|man|male|boy/.test(a) && !/women|woman/.test(a)) return "men";
  if (/unisex|neutral|everyone|all/.test(a)) return "unisex";
  if (/kid|child|teen/.test(a)) return "kids";
  return "unknown";
}

/** Hard questionnaire bounds passed into keyword + store search. */
export function answerBounds(profile: RecipientProfile, features: ProfileFeatures) {
  const gender = normalizeGender(profile.gender);
  const [minUsd, maxUsd] = features.budget ?? [null, null];
  return {
    relationship: profile.relationship || "",
    occasion: profile.occasion || "",
    ageRange: features.ageRange || profile.ageRange || "",
    ageGroup: features.ageGroup,
    gender,
    genderLabel: gender === "unspecified" ? null : gender,
    vibe: profile.vibe || "",
    interests: profile.interests.filter((i) => i && !i.startsWith("I don't really know")),
    wants: profile.wants || "",
    avoid: profile.avoid || "",
    avoidWords: features.avoidWords,
    budgetLabel: profile.budget || "",
    minUsd,
    maxUsd,
    giftType: features.giftType,
    hasKids: profile.hasKids || "",
  };
}

/**
 * Search / prompt cue for gender — children/teens use boys/girls, never "for men/women".
 */
export function genderSearchCue(ageGroup: AgeGroup, gender: GenderFit): string | null {
  if (gender === "unspecified" || gender === "nonbinary") return null;
  if (ageGroup === "child") {
    return gender === "woman" ? "for girls" : "for boys";
  }
  if (ageGroup === "teen") {
    return gender === "woman" ? "for teen girls" : "for teen boys";
  }
  return gender === "woman" ? "for women" : "for men";
}

/**
 * True when a product is clearly aimed at the opposite gender.
 * Kids/teens: only block adult opposite-gender or opposite kids-gender items — never
 * treat a 3-year-old boy as needing "men's" products.
 */
export function genderMismatch(
  product: Product,
  gender: GenderFit,
  ageGroup: AgeGroup = "adult",
): boolean {
  if (gender === "unspecified" || gender === "nonbinary") return false;

  const audience = resolveAudience(product);
  const blob = `${product.title} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase();
  const unisex = /\bunisex\b|\ball genders\b|\bfor everyone\b|\bgender.?neutral\b/.test(blob);
  if (unisex || audience === "unisex") return false;

  const adultWomen =
    audience === "women" ||
    /\b(women'?s|womens|for women|ladies|makeup|lipstick|mascara|nursing bra|menstrual)\b/.test(blob);
  const adultMen =
    audience === "men" ||
    /\b(men'?s|mens|for men|beard oil|beard trimmer|men'?s grooming)\b/.test(blob);
  const girls =
    /\b(girl'?s|for girls|little girl)\b/.test(blob) && !/\b(boy'?s|for boys)\b/.test(blob);
  const boys =
    /\b(boy'?s|for boys|little boy)\b/.test(blob) && !/\b(girl'?s|for girls)\b/.test(blob);

  if (ageGroup === "child" || ageGroup === "teen") {
    // Kids gifts are usually fine unless clearly for the opposite child gender or adult-only opposite sex.
    if (gender === "man") return adultWomen || girls;
    if (gender === "woman") return adultMen || boys;
    return false;
  }

  if (audience === "kids") return false;
  if (gender === "woman") return adultMen && !adultWomen;
  if (gender === "man") return adultWomen && !adultMen;
  return false;
}

/** Soft score boost when title/tags align with answered gender / interests. */
export function answerFitScore(product: Product, profile: RecipientProfile, features: ProfileFeatures): number {
  const bounds = answerBounds(profile, features);
  let score = 0;
  const blob = `${product.title} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase();
  const audience = resolveAudience(product);

  if (bounds.genderLabel === "woman") {
    if (features.ageGroup === "child" || features.ageGroup === "teen") {
      if (/\b(girl|girls)\b/.test(blob) || audience === "kids") score += 0.25;
    } else if (audience === "women") score += 0.35;
    else if (/\b(women|ladies|her |beauty|skincare|makeup)\b/.test(blob)) score += 0.2;
  }
  if (bounds.genderLabel === "man") {
    if (features.ageGroup === "child" || features.ageGroup === "teen") {
      if (/\b(boy|boys)\b/.test(blob) || audience === "kids") score += 0.25;
    } else if (audience === "men") score += 0.35;
    else if (/\b(men|his |grooming|beard)\b/.test(blob)) score += 0.2;
  }
  if (audience === "unisex" || audience === "kids") score += 0.05;

  for (const interest of bounds.interests) {
    const key = interest
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    if (key.some((w) => blob.includes(w))) score += 0.12;
  }
  if (bounds.vibe && blob.includes(bounds.vibe.toLowerCase().slice(0, 8))) score += 0.08;
  if (bounds.occasion && blob.includes(bounds.occasion.toLowerCase().split(/\s+/)[0] || "")) score += 0.05;

  if (genderMismatch(product, bounds.gender, features.ageGroup)) score -= 2;
  return score;
}

/**
 * Rank by questionnaire fit + real-user trending (segment click/buy stats).
 * Used for slot picks so results feel personal AND proven.
 */
export function trendingFitScore(
  product: Product,
  profile: RecipientProfile,
  features: ProfileFeatures,
  statsByProduct?: Map<string, ProductStats[]>,
): number {
  const fit = answerFitScore(product, profile, features);
  const beh = localBehaviorScore(statsByProduct?.get(product.id));
  const pop = Math.min(1, (product.popularity || 0) / 20);
  // Behavior only kicks in once we have evidence; buy-weighted clicks (from train) surface here.
  return fit + beh.score * beh.confidence * 0.55 + pop * 0.15 * Math.min(1, beh.confidence + 0.2);
}

/** Sort candidates so gender + interest + trending matches surface first. */
export function rankByAnswerFit(
  products: Product[],
  profile: RecipientProfile,
  features: ProfileFeatures,
  statsByProduct?: Map<string, ProductStats[]>,
): Product[] {
  return [...products].sort(
    (a, b) =>
      trendingFitScore(b, profile, features, statsByProduct) -
      trendingFitScore(a, profile, features, statsByProduct),
  );
}

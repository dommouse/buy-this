import type { ProfileFeatures } from "./profile";
import type { Product, RecipientProfile } from "../types";

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
 * True when a product is clearly aimed at the opposite gender.
 * Unisex / gender-neutral products always pass.
 */
export function genderMismatch(product: Product, gender: GenderFit): boolean {
  if (gender === "unspecified" || gender === "nonbinary") return false;
  const blob = `${product.title} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase();

  const unisex = /\bunisex\b|\ball genders\b|\bfor everyone\b|\bgender.?neutral\b/.test(blob);
  if (unisex) return false;

  const forWomen = /\b(women'?s|womens|for women|ladies|her |girl'?s|female)\b/.test(blob);
  const forMen = /\b(men'?s|mens|for men|his |boy'?s|male)\b/.test(blob);

  if (gender === "woman") {
    // Reject clearly men-only when not also women/unisex.
    return forMen && !forWomen;
  }
  if (gender === "man") {
    return forWomen && !forMen;
  }
  return false;
}

/** Soft score boost when title/tags align with answered gender / interests. */
export function answerFitScore(product: Product, profile: RecipientProfile, features: ProfileFeatures): number {
  const bounds = answerBounds(profile, features);
  let score = 0;
  const blob = `${product.title} ${product.description} ${product.category} ${product.tags.join(" ")}`.toLowerCase();

  if (bounds.genderLabel === "woman" && /\b(women|ladies|her |beauty|skincare|makeup)\b/.test(blob)) score += 0.2;
  if (bounds.genderLabel === "man" && /\b(men|his |grooming|beard)\b/.test(blob)) score += 0.2;

  for (const interest of bounds.interests) {
    const key = interest.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    if (key.some((w) => blob.includes(w))) score += 0.12;
  }
  if (bounds.vibe && blob.includes(bounds.vibe.toLowerCase().slice(0, 8))) score += 0.08;
  if (bounds.occasion && blob.includes(bounds.occasion.toLowerCase().split(/\s+/)[0] || "")) score += 0.05;

  if (genderMismatch(product, bounds.gender)) score -= 1;
  return score;
}

/** Sort candidates so gender + interest matches surface first for the picker. */
export function rankByAnswerFit(
  products: Product[],
  profile: RecipientProfile,
  features: ProfileFeatures,
): Product[] {
  return [...products].sort(
    (a, b) => answerFitScore(b, profile, features) - answerFitScore(a, profile, features),
  );
}

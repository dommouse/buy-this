import type { AgeGroup, GiftType, RecipientProfile } from "../types";

const BUDGETS: Record<string, [number, number]> = {
  "Under $25": [0, 25],
  "$25-$50": [25, 50],
  "$50-$100": [50, 100],
  "$100-$200": [100, 200],
  "$200-$350": [200, 350],
  "$350-$500": [350, 500],
  "$500+": [500, 5000],
};

const CHILD_AGES = ["Under 1", "1-2", "3-5", "6-8", "9-10", "11-12"];
const TEEN_AGES = ["13-15", "16-19"];

export type ProfileFeatures = {
  budget: [number, number] | null;
  ageGroup: AgeGroup;
  /** Exact questionnaire age label (e.g. "3-5", "30s") — used for Claude + filters. */
  ageRange: string;
  giftType: GiftType | null;
  /** Lower-cased signals matched against product tags. */
  signals: string[];
  avoidWords: string[];
  segment: string;
};

export function extractProfileFeatures(p: RecipientProfile): ProfileFeatures {
  const ageGroup: AgeGroup =
    CHILD_AGES.includes(p.ageRange) || p.relationship === "Child" ? "child" : TEEN_AGES.includes(p.ageRange) ? "teen" : "adult";
  const giftType: GiftType | null =
    p.giftType === "An Experience" ? "experience" : p.giftType === "A Gift Card or Cash" ? "giftcard" : p.giftType === "Something to Unwrap" ? "physical" : null;
  const interests = p.interests.filter((i) => !i.startsWith("I don't really know"));
  const signals = [...interests, p.vibe, p.relationship, p.occasion].filter(Boolean).map((s) => s.toLowerCase());
  const avoidWords = p.avoid.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  return {
    budget: BUDGETS[p.budget] ?? null,
    ageGroup,
    ageRange: p.ageRange || "",
    giftType,
    signals,
    avoidWords,
    // Coarse segment the training job learns click rates for.
    segment: segmentKey(p.relationship, p.occasion, ageGroup),
  };
}

export function segmentKey(relationship: string, occasion: string, ageGroup: string) {
  return [relationship || "any", occasion || "any", ageGroup].join("|").toLowerCase();
}

import type { AgeGroup, GiftType, RecipientProfile, WearUseDo } from "../types";
import { normalizeGender, type GenderFit } from "./fit";

/** New questionnaire budgets + legacy labels. */
const BUDGETS: Record<string, [number, number]> = {
  "Under $25": [0, 25],
  "$25-60": [25, 60],
  "$25-$50": [25, 50],
  "$50-$100": [50, 100],
  "$60-150": [60, 150],
  "$100-$200": [100, 200],
  "$150+": [150, 500],
  "$200-$350": [200, 350],
  "$350-$500": [350, 500],
  "$500+": [500, 5000],
};

const CHILD_AGES = ["1-3", "4-9", "Under 1", "1-2", "3-5", "6-8", "9-10", "11-12"];
const TEEN_AGES = ["10-15", "16-19", "13-15"];

export type ProfileFeatures = {
  budget: [number, number] | null;
  /** Hard wall: 75%–100% of stated max (Dominique rule). */
  priceWall: { min: number; max: number } | null;
  ageGroup: AgeGroup;
  ageRange: string;
  gender: GenderFit;
  giftType: GiftType | null;
  signals: string[];
  avoidWords: string[];
  segment: string;
  path: string;
  wearUseDo: WearUseDo;
  personality: string[];
};

function mapWearUseDo(raw: string | undefined): WearUseDo {
  const s = (raw || "").toLowerCase();
  if (s.includes("wear")) return "wear";
  if (s.includes("experience") || s.includes("do it")) return "do";
  if (s.includes("use")) return "use";
  return "";
}

function mapGiftType(p: RecipientProfile): GiftType | null {
  if (p.wearUseDo?.toLowerCase().includes("experience")) return "experience";
  if (p.giftType === "An Experience") return "experience";
  if (p.giftType === "A Gift Card or Cash") return "giftcard";
  if (p.giftType === "Something to Unwrap") return "physical";
  return null;
}

export function extractProfileFeatures(p: RecipientProfile): ProfileFeatures {
  const ageRange = p.ageRange || (p.graduationLevel ? "20-39" : "");
  let ageGroup: AgeGroup = "adult";
  if (CHILD_AGES.includes(ageRange) || (p.relationship === "Child" && !TEEN_AGES.includes(ageRange))) {
    ageGroup = ageRange === "10-15" || ageRange === "16-19" || TEEN_AGES.includes(ageRange) ? "teen" : "child";
  }
  if (TEEN_AGES.includes(ageRange) || ageRange === "10-15" || ageRange === "16-19") ageGroup = "teen";
  if (["1-3", "4-9"].includes(ageRange)) ageGroup = "child";
  // Baby Shower has no age step — catalog products are tagged child/baby.
  if (/baby shower/i.test(p.occasion)) ageGroup = "child";

  const interests = (p.interests || []).filter((i) => i && !i.startsWith("I don't really know"));
  const personality = p.personality?.length ? p.personality : p.vibe ? [p.vibe] : [];
  const gender = normalizeGender(p.gender);
  const signals = [
    ...interests,
    ...personality,
    p.vibe,
    p.relationship,
    p.occasion,
    p.parentType || "",
    p.helpWith || "",
    p.familyNeed || "",
    p.teenStyle || "",
    p.favorites || "",
    p.neverBuy || "",
    gender !== "unspecified" ? gender : "",
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  const avoidBits = [p.avoid, p.character ? "" : ""]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);

  const budget = BUDGETS[p.budget] ?? null;
  let priceWall: { min: number; max: number } | null = null;
  if (budget) {
    const [statedMin, max] = budget;
    // Under $25: wider floor. Open-ended ($150+ / $500+): floor near stated min
    // so we don’t demand 75% of an artificial ceiling (was $375–500 for “$150+”).
    let floor: number;
    if (max <= 25) floor = 8;
    else if (/\$150\+|\$500\+/.test(p.budget) || max >= 500) {
      floor = Math.max(statedMin, Math.round(statedMin * 0.85));
    } else if (max <= 60) floor = Math.round(max * 0.55);
    else floor = Math.round(max * 0.75);
    priceWall = { min: floor, max };
  }

  return {
    budget,
    priceWall,
    ageGroup,
    ageRange,
    gender,
    giftType: mapGiftType(p),
    signals,
    avoidWords: avoidBits,
    segment: segmentKey(p.relationship, p.occasion, ageGroup, gender),
    path: p.path || "",
    wearUseDo: mapWearUseDo(p.wearUseDo),
    personality,
  };
}

export function segmentKey(relationship: string, occasion: string, ageGroup: string, gender: string = "unspecified") {
  return [relationship || "any", occasion || "any", ageGroup, gender || "unspecified"].join("|").toLowerCase();
}

/** Map budget label → catalog price tier. */
export function budgetToTier(budget: string): string {
  if (budget === "Under $25") return "$";
  if (budget === "$25-60" || budget === "$25-$50") return "$$";
  if (budget === "$60-150" || budget === "$50-$100" || budget === "$100-$200") return "$$$";
  if (budget.includes("150") || budget.includes("200") || budget.includes("500")) return "$$$$";
  return "";
}

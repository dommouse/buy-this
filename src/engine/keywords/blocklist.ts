import { engineConfig } from "../config";
import type { ProfileFeatures } from "../features/profile";
import type { RecipientProfile } from "../types";

export type BlockContext = {
  profile: RecipientProfile;
  features: ProfileFeatures;
};

export type BlockRule = {
  id: string;
  /** Lowercase tokens / phrases matched inside the search phrase. */
  terms: string[];
  /** If omitted, rule always applies. */
  when?: (ctx: BlockContext) => boolean;
  reason: string;
};

/** Config-driven categories (candles, perfume, throw blankets, wallets, …). */
function avoidCategoryRules(): BlockRule[] {
  return engineConfig.avoidCategories.map((cat) => ({
    id: `avoid-${cat.id}`,
    terms: cat.terms,
    reason: `${cat.label} are too common — we never suggest them; pivot to a stronger gift.`,
  }));
}

function isPartner(relationship: string) {
  return /partner|spouse|boyfriend|girlfriend|wife|husband|fiancé|fiance/i.test(relationship);
}

function isParentsDay(occasion: string) {
  return /mother.?s\s*day|father.?s\s*day|mom.?s\s*day|dad.?s\s*day/i.test(occasion);
}

function isRomanticOccasion(occasion: string) {
  return /valentine|anniversary|date\s*night/i.test(occasion);
}

/**
 * Gift block list — search phrases that hit these must pivot (rethink), not soft-skip.
 * Keep store-agnostic: this filters keywords only, never SKUs.
 */
export const BLOCK_RULES: BlockRule[] = [
  ...avoidCategoryRules(),
  {
    id: "mugs",
    terms: ["mug", "mugs", "coffee mug", "tea mug"],
    reason: "Mugs are a lazy default — pivot to something more personal.",
  },
  {
    id: "socks",
    terms: ["sock", "socks", "ankle socks", "crew socks"],
    reason: "Socks feel like filler — pivot to a stronger gift angle.",
  },
  {
    id: "cooking-partner",
    terms: ["cooking", "kitchen", "cookware", "chef", "baking", "utensil", "skillet", "saucepan"],
    when: ({ profile }) => isPartner(profile.relationship) || isRomanticOccasion(profile.occasion),
    reason: "Cooking gear for romantic partners often reads as chores — pivot away from kitchen.",
  },
  {
    id: "work-parents-day",
    terms: [
      "office",
      "desk",
      "coworker",
      "work from home",
      "wfh",
      "professional",
      "briefcase",
      "laptop stand",
      "mouse pad",
      "planner for work",
    ],
    when: ({ profile }) => isParentsDay(profile.occasion),
    reason: "Work/office gifts clash with Mother's or Father's Day — pivot to personal appreciation.",
  },
  {
    id: "generic-gift-card-first",
    terms: ["amazon gift card", "visa gift card", "generic gift card"],
    reason: "Lead with a thoughtful product; gift cards only as a last-resort Wildcard.",
  },
  {
    id: "keychain-filler",
    terms: ["keychain", "key chain", "bottle opener keychain"],
    reason: "Keychains feel cheap filler — rethink the gift.",
  },
  {
    id: "alcohol-child-teen",
    terms: ["wine", "whiskey", "bourbon", "vodka", "tequila", "beer", "cocktail kit", "champagne"],
    when: ({ features }) => features.ageGroup === "child" || features.ageGroup === "teen",
    reason: "Alcohol is not age-appropriate — pivot immediately.",
  },
];

/** Extra avoid words from the questionnaire become hard blocks for phrases. */
export function avoidWordRules(avoid: string): BlockRule[] {
  const words = avoid
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!words.length) return [];
  return [
    {
      id: "user-avoid",
      terms: words,
      reason: "This conflicts with what they asked us to avoid — pivot the angle.",
    },
  ];
}

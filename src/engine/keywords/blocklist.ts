import type { ProfileFeatures } from "../features/profile";
import type { RecipientProfile } from "../types";

export type BlockContext = {
  profile: RecipientProfile;
  features: ProfileFeatures;
};

export type BlockRule = {
  id: string;
  terms: string[];
  reason: string;
  when?: (ctx: BlockContext) => boolean;
};

/** Universal + conditional blocks from Gift Brain rules (enforced in code). */
export const BLOCK_RULES: BlockRule[] = [
  {
    id: "universal",
    reason: "too common / never suggest",
    terms: [
      "mug",
      "socks",
      "gift basket",
      "plated",
      "costume jewelry",
      "throw blanket",
      "fleece blanket",
      "wallet",
      "bifold",
    ],
  },
  {
    id: "adult-scent",
    reason: "adults 20+ already know their scent",
    terms: ["candle", "perfume", "cologne", "skincare", "body lotion"],
    when: ({ features }) => features.ageGroup === "adult",
  },
  {
    id: "kitchen-ban",
    reason: "cooking → food culture redirect (except housewarming)",
    terms: [
      "pots",
      "pans",
      "instant pot",
      "air fryer",
      "cutting board",
      "knife set",
      "apron",
      "bakeware",
      "kitchen utensil",
      "blender",
      "stand mixer",
    ],
    when: ({ profile }) => !/housewarming/i.test(profile.occasion),
  },
  {
    id: "partner-blocks",
    reason: "partner romance mode",
    terms: ["fitness", "workout", "anti-aging", "cleaning", "tool set", "yard"],
    when: ({ profile }) => /partner|spouse/i.test(profile.relationship),
  },
  {
    id: "romance-blocks",
    reason: "valentine/anniversary romance only",
    terms: ["fitness", "workout", "tool", "cleaning", "cookware", "kitchen"],
    when: ({ profile }) => /valentine|anniversary/i.test(profile.occasion),
  },
  {
    id: "mothers-day",
    reason: "no work gifts for Mother's Day",
    terms: ["apron", "cleaning", "planner", "organize", "cooking tool"],
    when: ({ profile }) => /mother'?s day/i.test(profile.occasion),
  },
  {
    id: "fathers-day",
    reason: "no work gifts for Father's Day",
    terms: ["tie", "necktie", "briefcase", "work bag", "yard tool", "lawn"],
    when: ({ profile }) => /father'?s day/i.test(profile.occasion),
  },
  {
    id: "baby-shower",
    reason: "baby shower safety rules",
    terms: ["baby clothes", "onesie", "crib bumper", "swaddle blanket", "crib pillow", "loose blanket"],
    when: ({ profile }) => /baby shower/i.test(profile.occasion),
  },
  {
    id: "housewarming-decor",
    reason: "housewarming: no decor",
    terms: ["wall art", "decorative pillow", "picture frame", "candle warmer", "throw blanket", "home decor"],
    when: ({ profile }) => /housewarming/i.test(profile.occasion),
  },
  {
    id: "coworker",
    reason: "coworker safe mode",
    terms: ["perfume", "jewelry", "lingerie", "romantic", "clothing"],
    when: ({ profile }) => /coworker|boss/i.test(profile.relationship),
  },
];

/** Build custom block rules from free-text avoid answer. */
export function avoidWordRules(avoid: string): BlockRule[] {
  const terms = avoid
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!terms.length) return [];
  return [{ id: "custom-avoid", reason: "user asked to avoid", terms }];
}

export function titleHitsBlocklist(
  title: string,
  profile: RecipientProfile,
  features: ProfileFeatures,
): boolean {
  const ctx: BlockContext = { profile, features };
  const blob = ` ${title.toLowerCase().replace(/[^a-z0-9\s]/g, " ")} `;
  for (const rule of [...BLOCK_RULES, ...avoidWordRules(profile.avoid || "")]) {
    if (rule.when && !rule.when(ctx)) continue;
    for (const term of rule.terms) {
      if (blob.includes(term.toLowerCase())) return true;
    }
  }
  for (const w of features.avoidWords) {
    if (w.length > 3 && blob.includes(w)) return true;
  }
  return false;
}

import type { ProfileFeatures } from "../features/profile";
import {
  keywordsForInterest,
  keywordsForPersonality,
  tokensFromWants,
} from "../keywords/interest-keywords";
import type { RecipientProfile, SearchCategory, Slot } from "../types";
import { SLOTS } from "../scoring/ranker";

export type SearchObject = {
  slot: Slot;
  /** 3–5 words. Never include price, age, gender, or year. */
  keywords: string;
  category: SearchCategory;
  priceMin: number;
  priceMax: number;
  sort: "relevance" | "newest" | "rating";
  retailerPriority: ("curated" | "amazon")[];
  backup: { keywords: string; category: SearchCategory };
};

type Phrase = { words: string; category: SearchCategory };

/** Cooking → food culture (never kitchen gear except housewarming entertain). */
function interestKeywords(interest: string, occasion: string): Phrase {
  const i = interest.toLowerCase();
  const housewarming = /housewarming/i.test(occasion);

  if (/cook|food|chef|gourmet|foodie/.test(i)) {
    if (housewarming) return { words: "entertaining popcorn maker", category: "HOME" };
    return { words: "artisan food gift set", category: "FOOD_GOURMET" };
  }
  if (/sport|fitness|active/.test(i)) return { words: "premium sports gear", category: "SPORTS" };
  if (/music/.test(i)) return { words: "wireless headphones premium", category: "TECH" };
  if (/gaming|gamer|game/.test(i)) return { words: "gaming headset wireless", category: "TECH" };
  if (/read|book/.test(i)) return { words: "bestseller book set", category: "BOOKS" };
  if (/travel/.test(i)) return { words: "leather travel accessory", category: "FASHION_WOMEN" };
  if (/fashion|beauty|hair|girly|trendy/.test(i)) return { words: "trendy fashion accessory", category: "FASHION_WOMEN" };
  if (/tech|gadget/.test(i)) return { words: "portable power bank", category: "TECH" };
  if (/art|craft|lego|building|dinosaur|science|princess|superhero/.test(i)) {
    return { words: "creative kids kit", category: "TOYS_KIDS" };
  }
  if (/outdoor|garden|outdoorsy/.test(i)) return { words: "outdoor adventure gear", category: "OUTDOOR" };
  if (/pet|animal/.test(i)) return { words: "premium pet accessory", category: "HOME" };
  if (/movie|tv/.test(i)) return { words: "streaming device 4k", category: "TECH" };
  if (/car|motor|vehicle/.test(i)) return { words: "car phone mount premium", category: "TECH" };
  if (/wine|cocktail|drink|bar/.test(i)) return { words: "cocktail shaker set", category: "HOME" };
  if (/coffee/.test(i)) return { words: "insulated coffee tumbler", category: "HOME" };
  if (/team/.test(i)) return { words: "sports team gear", category: "SPORTS" };
  if (/entertain|gadget|game/.test(i) && housewarming) return { words: "party entertaining gadget", category: "HOME" };

  const mapped = keywordsForInterest(interest);
  return { words: mapped.primary[0] || "thoughtful gift set", category: "HOME" };
}

/** Adult personality label → shoppable phrase (never bare “creative”). */
function personalityPhrase(label: string, angle: "primary" | "premium" | "practical" = "primary"): Phrase {
  const set = keywordsForPersonality(label);
  const words = set[angle][0] || set.primary[0] || "thoughtful gift set";
  const l = label.toLowerCase();
  let category: SearchCategory = "HOME";
  if (/tech|gamer|music|movie|tv|career/.test(l)) category = "TECH";
  else if (/read|intellectual|loves to read/.test(l)) category = "BOOKS";
  else if (/active|outdoorsy|sports|gardener/.test(l)) category = "OUTDOOR";
  else if (/foodie|wine|cocktail/.test(l)) category = "FOOD_GOURMET";
  else if (/trendy|fashion|luxury|romantic|sentimental/.test(l)) category = "FASHION_WOMEN";
  else if (/creative|diy|maker/.test(l)) category = "HOME";
  return { words, category };
}

/** Free-text talkAbout / wants → shoppable words (strip filler, keep product nouns). */
function freeTextPhrase(raw: string): Phrase | null {
  const blob = raw.toLowerCase();
  // Vague free-text → concrete product phrases (don’t search “fashion trending things”).
  if (/fashion|trendy|style|outfit|clothes/.test(blob)) {
    return { words: "trendy fashion accessory", category: "FASHION_WOMEN" };
  }
  if (/beauty|skincare|makeup|spa|self.?care/.test(blob)) {
    return { words: "spa beauty gift set", category: "BEAUTY" };
  }
  if (/tech|gadget|phone|laptop|headphone|electronics/.test(blob)) {
    return { words: "portable tech gadget", category: "TECH" };
  }
  if (/book|read|novel/.test(blob)) return { words: "bestseller book set", category: "BOOKS" };
  if (/food|cook|kitchen|wine|coffee|restaurant/.test(blob)) {
    return { words: "artisan food gift set", category: "FOOD_GOURMET" };
  }
  if (/sport|fitness|outdoor|hike|gym/.test(blob)) {
    return { words: "fitness workout gear", category: "OUTDOOR" };
  }
  if (/jewelry|necklace|bracelet/.test(blob)) {
    return { words: "personalized jewelry necklace", category: "FASHION_WOMEN" };
  }

  const tokens = tokensFromWants(raw);
  if (tokens.length === 0) return null;
  return { words: tokens.slice(0, 4).join(" "), category: "HOME" };
}

/** Occasion / relationship boosters for adult Path E (and similar). */
function occasionBoost(occasion: string, relationship: string, gender: string): Phrase {
  const o = (occasion || "").toLowerCase();
  const r = (relationship || "").toLowerCase();
  const woman =
    /woman|female|girl|mom|mother|wife|girlfriend|partner/i.test(`${gender} ${r}`) ||
    /mother'?s day|valentine|anniversary/i.test(o);

  if (/mother'?s day/.test(o)) {
    return woman
      ? { words: "spa pamper set mom", category: "BEAUTY" }
      : { words: "personalized keepsake mom", category: "HOME" };
  }
  if (/father'?s day/.test(o)) return { words: "dad grilling accessory", category: "HOME" };
  if (/graduation/.test(o)) return { words: "graduation desk accessory", category: "TECH" };
  if (/valentine|anniversary/.test(o)) {
    return { words: "romantic personalized jewelry", category: "FASHION_WOMEN" };
  }
  if (/housewarming/.test(o)) return { words: "home entertaining set", category: "HOME" };
  if (/christmas|birthday|other/.test(o)) {
    return woman
      ? { words: "personalized keepsake set", category: "HOME" }
      : { words: "quality everyday accessory", category: "HOME" };
  }
  return { words: "personalized keepsake set", category: "HOME" };
}

function wearAngle(wearUseDo: string, base: Phrase): Phrase {
  const w = (wearUseDo || "").toLowerCase();
  if (w.includes("wear")) {
    return {
      words: base.category.startsWith("FASHION") ? base.words : "fashion accessory stylish",
      category: "FASHION_WOMEN",
    };
  }
  if (w.includes("experience") || w.includes("do")) {
    return { words: "experience gift card", category: "HOME" };
  }
  return base;
}

/** Baby Shower helpWith → Amazon-friendly baby keywords (never kids kits / books). */
function babyHelpKeywords(helpWith: string): { main: string; backup: string; category: SearchCategory } {
  const h = (helpWith || "").toLowerCase();
  if (/sleep/.test(h)) return { main: "baby swaddle sack", backup: "bassinet top rated", category: "BABY" };
  if (/feed/.test(h)) return { main: "baby bottle warmer", backup: "breast pump accessories", category: "BABY" };
  if (/bath/.test(h)) return { main: "baby bath tub", backup: "infant bath set", category: "BABY" };
  if (/around|travel|getting/.test(h)) return { main: "baby stroller travel", backup: "infant car seat", category: "BABY" };
  if (/nursery/.test(h)) return { main: "nursery sound machine", backup: "baby monitor", category: "BABY" };
  if (/play/.test(h)) return { main: "baby play gym", backup: "infant sensory toy", category: "BABY" };
  if (/postpartum|mom/.test(h)) return { main: "postpartum care kit", backup: "new mom gift basket", category: "BABY" };
  return { main: "top rated baby essential", backup: "baby shower gift", category: "BABY" };
}

function babyParentAngle(parentType: string): string {
  const p = (parentType || "").toLowerCase();
  if (/on the go|always on/.test(p)) return "portable baby travel";
  if (/safety/.test(p)) return "safety certified baby";
  if (/minimal/.test(p)) return "minimalist baby essential";
  if (/tech/.test(p)) return "smart baby monitor";
  if (/creative|sentimental/.test(p)) return "baby keepsake frame";
  return "top rated baby";
}

/**
 * Clamp to 3–5 shoppable words. Never pad with “bestseller” — that creates junk
 * queries like “creative bestseller bestseller”.
 */
function clampKeywords(words: string): string {
  const filler = new Set([
    "under",
    "for",
    "women",
    "men",
    "boys",
    "girls",
    "gift",
    "gifts",
    "ideas",
    "idea",
    "practical",
    "premium",
    "bestseller",
    "bestsellers",
    "popular",
    "unique",
    "everyday",
    "quality",
    "surprise",
    "find",
    "things",
    "stuff",
    "and",
    "the",
    "a",
    "an",
    "they",
    "them",
    "like",
    "loves",
    "love",
  ]);
  const parts = words
    .toLowerCase()
    .replace(/\$?\d+/g, " ")
    .replace(/202\d/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !filler.has(w));

  // Dedupe consecutive repeats (“creative creative”)
  const deduped: string[] = [];
  for (const w of parts) {
    if (deduped[deduped.length - 1] !== w) deduped.push(w);
  }

  let out = deduped.slice(0, 5);
  // Pad with real product nouns only when too short
  const pads = ["set", "kit", "accessory"];
  let pi = 0;
  while (out.length < 3 && pi < pads.length) {
    if (!out.includes(pads[pi]!)) out.push(pads[pi]!);
    pi += 1;
  }
  if (out.length < 3) out = ["thoughtful", "gift", "set"];
  return out.slice(0, 5).join(" ");
}

/**
 * Budget wall: aim 75–100% of max for fixed bands.
 * Open-ended ($150+, $500+): floor near stated min so Amazon isn’t empty.
 */
function priceWall(features: ProfileFeatures, budgetLabel: string): { min: number; max: number } {
  if (features.budget) {
    const [statedMin, max] = features.budget;
    if (max <= 25) return { min: 8, max };
    // Open-ended ceilings are artificial — don’t require 75% of 500/5000.
    if (/\$150\+|\$500\+/.test(budgetLabel) || max >= 500) {
      return { min: Math.max(statedMin, Math.round(statedMin * 0.85)), max };
    }
    if (max <= 60) return { min: Math.round(max * 0.55), max };
    return { min: Math.round(max * 0.75), max };
  }
  if (features.priceWall) return features.priceWall;
  return { min: 20, max: 60 };
}

function categoryForGender(cat: SearchCategory, gender: string): SearchCategory {
  // Word boundaries — bare /man/ also matches "Woman".
  const isMan = /\b(man|male|boy|men|boys)\b/i.test(gender);
  if (cat === "FASHION_WOMEN" && isMan) return "FASHION_MEN";
  if (cat === "BEAUTY" && isMan) return "TECH";
  return cat;
}

function buildBabyShowerObjects(
  profile: RecipientProfile,
  min: number,
  max: number,
): SearchObject[] {
  const help = babyHelpKeywords(profile.helpWith || "");
  const angle = babyParentAngle(profile.parentType || "");
  const firstBaby = /not the first/i.test(profile.firstBaby || "");
  const retailers: ("curated" | "amazon")[] = ["curated", "amazon"];

  const oneWords = firstBaby ? `${help.main} upgrade` : help.main;
  const wowWords = angle;
  const smartWords = firstBaby ? "postpartum mom care" : "diaper caddy organizer";
  const wildWords = firstBaby ? "ubereats gift card" : "baby wipe warmer";

  const mk = (
    slot: Slot,
    keywords: string,
    backup: string,
    sort: SearchObject["sort"],
  ): SearchObject => ({
    slot,
    keywords: clampKeywords(keywords),
    category: "BABY",
    priceMin: min,
    priceMax: max,
    sort,
    retailerPriority: retailers,
    backup: { keywords: clampKeywords(backup), category: "BABY" },
  });

  return [
    mk("The One", oneWords, help.backup, "rating"),
    mk("The Wow", wowWords, help.main, "newest"),
    mk("The Smart Pick", smartWords, "baby care essential", "rating"),
    mk("The Wildcard", wildWords, "newborn baby gift", "relevance"),
  ];
}

/** Adult / teen Path E-style: personality + talkAbout + occasion drive phrases. */
function buildAdultObjects(
  profile: RecipientProfile,
  min: number,
  max: number,
): SearchObject[] {
  const personalities = (profile.personality || []).filter(Boolean);
  const interests = (profile.interests || []).filter(Boolean);
  const free =
    freeTextPhrase(profile.talkAbout || "") ||
    freeTextPhrase(profile.wants || "") ||
    freeTextPhrase(profile.character || "");
  const occasion = occasionBoost(profile.occasion, profile.relationship, profile.gender);
  const p0 = personalities[0];
  const p1 = personalities[1] || p0;
  const interest0 = interests[0];

  const primaryPers = p0 ? personalityPhrase(p0, "primary") : null;
  const premiumPers = p0 ? personalityPhrase(p0, "premium") : null;
  const practicalPers = (p1 || p0) ? personalityPhrase(p1 || p0!, "practical") : null;
  const interestPhrase = interest0 ? interestKeywords(interest0, profile.occasion) : null;

  // The One: free-text first (The One priority), else personality, else interest, else occasion
  let oneBase: Phrase = free || primaryPers || interestPhrase || occasion;
  oneBase = wearAngle(profile.wearUseDo || "", oneBase);

  // The Wow: second personality / premium angle / occasion twist
  let wowBase: Phrase =
    (p1 && p1 !== p0 ? personalityPhrase(p1, "premium") : null) ||
    premiumPers ||
    occasion ||
    oneBase;

  // Smart Pick: practical everyday from personality or interest
  let smartBase: Phrase =
    practicalPers ||
    (interestPhrase
      ? { words: `everyday ${interestPhrase.words}`, category: interestPhrase.category }
      : null) ||
    { words: "everyday quality accessory", category: "HOME" };

  // Wildcard: occasion or contrasting personality angle
  let wildBase: Phrase =
    occasion.words !== oneBase.words
      ? occasion
      : personalityPhrase(p0 || "Practical", "premium");

  if (!p0 && !free && interestPhrase) {
    oneBase = interestPhrase;
    wowBase = interestKeywords(interests[1] || interest0!, profile.occasion);
    smartBase = { words: `everyday ${interestPhrase.words}`, category: interestPhrase.category };
  }

  const retailers: ("curated" | "amazon")[] = ["curated", "amazon"];

  const mk = (
    slot: Slot,
    base: Phrase,
    backup: Phrase,
    sort: SearchObject["sort"],
  ): SearchObject => {
    const category = categoryForGender(base.category, profile.gender);
    return {
      slot,
      keywords: clampKeywords(base.words),
      category,
      priceMin: min,
      priceMax: max,
      sort,
      retailerPriority: retailers,
      backup: {
        keywords: clampKeywords(backup.words),
        category: categoryForGender(backup.category, profile.gender),
      },
    };
  };

  return [
    mk("The One", oneBase, primaryPers || occasion, "rating"),
    mk("The Wow", wowBase, premiumPers || occasion, "newest"),
    mk("The Smart Pick", smartBase, practicalPers || oneBase, "rating"),
    mk("The Wildcard", wildBase, interestPhrase || occasion, "relevance"),
  ];
}

/**
 * Build exactly 4 SearchObjects from answers (Dominique slot formulas).
 * Keywords are 3–5 words; budget lives in priceMin/Max only.
 */
export function buildSearchObjects(
  profile: RecipientProfile,
  features: ProfileFeatures,
): SearchObject[] {
  const { min, max } = priceWall(features, profile.budget || "");

  if (/baby shower/i.test(profile.occasion)) {
    return buildBabyShowerObjects(profile, min, max);
  }

  // Adult Path E (and any path with personality / talkAbout) uses mature builder
  if (
    features.ageGroup === "adult" ||
    profile.personality?.length ||
    profile.talkAbout ||
    /mother'?s day|father'?s day|graduation|valentine|anniversary|housewarming/i.test(
      profile.occasion || "",
    )
  ) {
    return buildAdultObjects(profile, min, max);
  }

  // Kids / teens with interests
  const interests = profile.interests.filter(Boolean);
  const primary = interests[0] || profile.helpWith || profile.neverBuy || profile.favorites || profile.vibe || "premium";
  const secondary = interests[1] || profile.personality?.[0] || profile.teenStyle || primary;
  const wants = (profile.wants || profile.talkAbout || profile.character || "").trim();

  const oneBase = wants
    ? freeTextPhrase(wants) || { words: wants.split(/\s+/).slice(0, 4).join(" "), category: "HOME" as SearchCategory }
    : interestKeywords(primary, profile.occasion);
  const wowBase = interestKeywords(`${primary} ${secondary}`.trim(), profile.occasion);
  const smartBase = interestKeywords(primary, profile.occasion);
  const wildBase = interestKeywords(
    profile.personality?.[0] || profile.teenStyle || profile.howFeel || secondary,
    profile.occasion,
  );

  if (features.ageGroup === "child") {
    oneBase.category = "TOYS_KIDS";
    wowBase.category = "TOYS_KIDS";
    smartBase.category = "TOYS_KIDS";
    wildBase.category = "TOYS_KIDS";
  }

  const retailers: ("curated" | "amazon")[] = ["curated", "amazon"];

  const mk = (
    slot: Slot,
    base: { words: string; category: SearchCategory },
    backupWords: string,
    sort: SearchObject["sort"],
  ): SearchObject => {
    const category = categoryForGender(base.category, profile.gender);
    return {
      slot,
      keywords: clampKeywords(base.words),
      category,
      priceMin: min,
      priceMax: max,
      sort,
      retailerPriority: retailers,
      backup: {
        keywords: clampKeywords(backupWords),
        category,
      },
    };
  };

  const bySlot: Record<Slot, SearchObject> = {
    "The One": mk("The One", oneBase, `${primary} set`, "rating"),
    "The Wow": mk("The Wow", wowBase, `${secondary} kit`, "newest"),
    "The Smart Pick": mk(
      "The Smart Pick",
      { words: `everyday ${smartBase.words}`, category: smartBase.category },
      `${primary} accessory`,
      "rating",
    ),
    "The Wildcard": mk("The Wildcard", wildBase, `${secondary} find`, "relevance"),
  };

  return SLOTS.map((s) => bySlot[s]);
}

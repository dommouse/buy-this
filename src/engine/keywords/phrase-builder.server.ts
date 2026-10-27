import { answerBounds, genderSearchCue } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import { SLOTS } from "../scoring/ranker";
import type { AgeGroup, RecipientProfile, Slot } from "../types";
import { engineLog, engineWarn } from "../utils/logger";
import { findBlockHits, type BlockHit } from "./filter";
import {
  keywordsForInterest,
  keywordsForVibe,
  tokensFromWants,
  type InterestKeywordSet,
} from "./interest-keywords";
import type { SlotPhrase } from "./types";

const MAX_PIVOTS = 3;

/** Short budget cue Amazon understands — omit when unknown. */
function budgetCue(features: ProfileFeatures): string {
  if (!features.budget) return "";
  const [, max] = features.budget;
  if (max == null || max >= 5000) return "";
  return `under $${max}`;
}

/** Kids/teens need age in the query; adults rarely do. */
function ageCue(ageGroup: AgeGroup, ageRange: string): string {
  if (ageGroup === "child" && ageRange) {
    if (/under\s*1/i.test(ageRange)) return "baby toddler";
    return `ages ${ageRange.replace(/\s+/g, "")}`;
  }
  if (ageGroup === "teen") return "teen";
  return "";
}

function giftTypeCue(giftType: ProfileFeatures["giftType"]): string {
  if (giftType === "giftcard") return "gift card";
  if (giftType === "experience") return "experience ticket class";
  return "";
}

function pickCore(slot: Slot, sets: InterestKeywordSet[], vibeKeys: string[], wantTokens: string[]): string {
  const primary = sets[0];
  const secondary = sets[1] || sets[0];
  const tertiary = sets[2] || sets[1] || sets[0];

  switch (slot) {
    case "The One":
      // User wants first, else primary interest product term.
      if (wantTokens.length >= 2) return wantTokens.slice(0, 3).join(" ");
      if (wantTokens.length === 1 && primary) return `${wantTokens[0]} ${primary.primary[0]}`;
      return primary?.primary[0] || vibeKeys[0] || "popular item";
    case "The Wow":
      return primary?.premium[0] || secondary?.premium[0] || primary?.primary[1] || "premium gift";
    case "The Smart Pick":
      return primary?.practical[0] || secondary?.practical[0] || primary?.primary[0] || "useful everyday";
    case "The Wildcard":
      return (
        secondary?.primary[0] ||
        tertiary?.primary[0] ||
        vibeKeys[0] ||
        primary?.primary[1] ||
        primary?.primary[0] ||
        "unique find"
      );
  }
}

/**
 * Build a tight Amazon query:
 *   [product keywords] [for women|men|boys|girls] [ages …] [under $N]
 * No year, occasion, relationship, or vague "gift ideas".
 */
function buildTightPhrase(parts: {
  core: string;
  who: string | null;
  age: string;
  budget: string;
  giftType: string;
}): string {
  const raw = [parts.core, parts.who || "", parts.age, parts.giftType, parts.budget]
    .filter(Boolean)
    .join(" ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Drop leftover filler if any slipped in from free text.
  return raw
    .replace(/\b(gift ideas?|best gifts?|presents?|202\d|deluxe|wow|surprise)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * Gift Brain phrase builder — answer keywords only, Amazon-ready.
 */
export async function buildSlotPhrases(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
}): Promise<SlotPhrase[]> {
  const { profile, features } = input;
  const bounds = answerBounds(profile, features);
  const interests = bounds.interests.slice(0, 3);
  const sets = interests.map(keywordsForInterest);
  const vibeKeys = keywordsForVibe(profile.vibe || "");
  const wantTokens = tokensFromWants(profile.wants || "");
  const who = genderSearchCue(features.ageGroup, bounds.gender);
  const age = ageCue(features.ageGroup, bounds.ageRange);
  const budget = budgetCue(features);
  const giftType = giftTypeCue(features.giftType);

  engineLog("engine: building search phrases (tight keywords)");

  const out: SlotPhrase[] = [];
  for (const slot of SLOTS) {
    const core = pickCore(slot, sets, vibeKeys, wantTokens);
    const phrase = buildTightPhrase({ core, who, age, budget, giftType });
    out.push({
      slot,
      phrase,
      angle: core.slice(0, 80),
      pivotCount: 0,
    });
    engineLog(`engine: phrase ${slot} →`, phrase);
  }
  return out;
}

/** Template pivot — swap to next keyword angle, still tight. */
export async function pivotBlockedPhrase(input: {
  blocked: SlotPhrase;
  hits: BlockHit[];
  profile: RecipientProfile;
  features: ProfileFeatures;
  otherPhrases: string[];
}): Promise<SlotPhrase> {
  const { blocked, profile, features } = input;
  const bounds = answerBounds(profile, features);
  const sets = bounds.interests.slice(0, 3).map(keywordsForInterest);
  const vibeKeys = keywordsForVibe(profile.vibe || "");
  const wantTokens = tokensFromWants(profile.wants || "");
  const who = genderSearchCue(features.ageGroup, bounds.gender);
  const age = ageCue(features.ageGroup, bounds.ageRange);
  const budget = budgetCue(features);
  const giftType = giftTypeCue(features.giftType);

  const primary = sets[0];
  const pool = [
    ...(primary?.primary ?? []),
    ...(primary?.practical ?? []),
    ...(primary?.premium ?? []),
    ...(sets[1]?.primary ?? []),
    ...vibeKeys,
    ...wantTokens,
  ].filter(Boolean);

  const next = pool[Math.min(blocked.pivotCount + 1, Math.max(0, pool.length - 1))] || "popular item";
  const phrase = buildTightPhrase({ core: next, who, age, budget, giftType });
  engineWarn(`engine: phrase pivoted for ${blocked.slot} →`, phrase);
  return {
    slot: blocked.slot,
    phrase,
    angle: next.slice(0, 80),
    pivotCount: blocked.pivotCount + 1,
  };
}

export async function filterAndPivotPhrases(input: {
  phrases: SlotPhrase[];
  profile: RecipientProfile;
  features: ProfileFeatures;
}): Promise<SlotPhrase[]> {
  const { profile, features } = input;
  const cleaned: SlotPhrase[] = [];

  for (const start of input.phrases) {
    let current = start;
    for (let i = 0; i <= MAX_PIVOTS; i++) {
      const hits = findBlockHits(current.phrase, profile, features);
      if (!hits.length) {
        cleaned.push(current);
        break;
      }
      engineWarn(
        `engine: phrase blocked for ${current.slot} — ${hits.map((h) => h.ruleId).join(",")}; pivoting`,
        current.phrase,
      );
      if (i === MAX_PIVOTS) {
        engineWarn(`engine: giving up on ${current.slot} after ${MAX_PIVOTS} pivots`);
        break;
      }
      current = await pivotBlockedPhrase({
        blocked: current,
        hits,
        profile,
        features,
        otherPhrases: [...cleaned, ...input.phrases].map((p) => p.phrase),
      });
    }
  }
  return cleaned;
}

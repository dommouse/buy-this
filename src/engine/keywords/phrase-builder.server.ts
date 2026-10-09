import { callClaude, extractJsonObject } from "../ai/claude-client.server";
import { engineConfig } from "../config";
import { answerBounds } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import { SLOTS } from "../scoring/ranker";
import type { RecipientProfile, Slot } from "../types";
import { engineWarn } from "../utils/logger";
import { findBlockHits, type BlockHit } from "./filter";
import type { SlotPhrase } from "./types";

function avoidedLabels(): string {
  return engineConfig.avoidCategories.map((c) => c.label).join(", ");
}

const YEAR = new Date().getFullYear();
const MAX_PIVOTS = 3;

function budgetHint(features: ProfileFeatures, budgetLabel: string): string {
  if (!features.budget) return budgetLabel || "flexible budget";
  const [, max] = features.budget;
  return `under ${max}`;
}

function slotIntent(slot: Slot): string {
  switch (slot) {
    case "The One":
      return "best overall fit — the gift that just lands";
    case "The Wow":
      return "memorable showstopper with delight factor";
    case "The Smart Pick":
      return "practical thoughtful gift that still feels special";
    case "The Wildcard":
      return "unexpected delightful surprise angle";
  }
}

/**
 * AI builds one smart search phrase per gift slot from the questionnaire.
 * Phrases are store-agnostic (no Amazon/ASIN) — stores consume them later.
 * Age, budget, and gender (when answered) are HARD cues in every phrase.
 */
export async function buildSlotPhrases(input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
}): Promise<SlotPhrase[]> {
  const { profile, features } = input;
  const bounds = answerBounds(profile, features);
  const budget = budgetHint(features, profile.budget);
  const genderCue =
    bounds.genderLabel != null
      ? `Include gender cue "${bounds.genderLabel === "woman" ? "for women" : bounds.genderLabel === "man" ? "for men" : "unisex"}" in every phrase.`
      : "Gender was not selected — keep phrases gender-neutral / unisex.";

  const system =
    "You are Dominique, keyword brain for BUY THIS. " +
    "Build SHORT Amazon-style search phrases from questionnaire answers — not product titles, not ASINs. " +
    "HARD BOUNDS (must appear as cues in every phrase): " +
    `age (${bounds.ageRange || bounds.ageGroup}), budget ("${budget}"), and gender when answered. ` +
    `${genderCue} ` +
    `Also weave relationship, occasion, vibe, and top interests. Year ${YEAR} when it helps. ` +
    "Example: trending kitchen gadget for women 30s under 100 birthday. " +
    "Each of the 4 slots needs a DISTINCT product ANGLE (different category/interest) so results do not repeat. " +
    "Never suggest filler gifts (mugs, socks). " +
    `NEVER suggest these avoided categories: ${avoidedLabels()}. ` +
    "Return ONLY JSON: {\"phrases\":[{\"slot\":\"The One|The Wow|The Smart Pick|The Wildcard\",\"phrase\":\"...\",\"angle\":\"max 12 words\"}]}.";

  const prompt = JSON.stringify({
    hardBounds: {
      ageRange: bounds.ageRange,
      ageGroup: bounds.ageGroup,
      gender: bounds.gender,
      budgetHint: budget,
      minUsd: bounds.minUsd,
      maxUsd: bounds.maxUsd,
      relationship: bounds.relationship,
      occasion: bounds.occasion,
    },
    softSignals: {
      vibe: bounds.vibe,
      interests: bounds.interests,
      wants: bounds.wants,
      avoid: bounds.avoid,
      giftType: bounds.giftType,
      hasKids: bounds.hasKids,
    },
    slots: SLOTS.map((slot) => ({ slot, intent: slotIntent(slot) })),
  });

  const text = await callClaude(system, prompt);
  const raw = extractJsonObject(text);
  if (!raw) throw new Error("Claude returned no phrase JSON");
  const parsed = JSON.parse(raw) as {
    phrases?: { slot?: string; phrase?: string; angle?: string }[];
  };
  const bySlot = new Map<Slot, SlotPhrase>();
  for (const row of parsed.phrases ?? []) {
    const slot = SLOTS.find((s) => s === row.slot);
    let phrase = String(row.phrase ?? "")
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    if (!slot || !phrase) continue;
    phrase = ensureBoundCues(phrase, bounds, budget);
    bySlot.set(slot, { slot, phrase, angle: String(row.angle ?? "").slice(0, 80), pivotCount: 0 });
  }

  // Ensure all 4 slots exist with a deterministic fallback phrase.
  const out: SlotPhrase[] = [];
  for (const slot of SLOTS) {
    const existing = bySlot.get(slot);
    if (existing) {
      out.push(existing);
      continue;
    }
    const interest = profile.interests[0] || profile.vibe || "gift";
    const who = [
      bounds.genderLabel === "woman" ? "for women" : bounds.genderLabel === "man" ? "for men" : "",
      features.ageRange || features.ageGroup,
    ]
      .filter(Boolean)
      .join(" ");
    const phrase = ensureBoundCues(
      `${interest} ${who} ${profile.occasion} ${budget} ${YEAR}`.replace(/\s+/g, " ").trim(),
      bounds,
      budget,
    );
    out.push({
      slot,
      phrase,
      angle: slotIntent(slot),
      pivotCount: 0,
    });
  }
  return out;
}

/** Append missing age / budget / gender cues so store search always sees hard bounds. */
function ensureBoundCues(
  phrase: string,
  bounds: ReturnType<typeof answerBounds>,
  budget: string,
): string {
  let p = phrase;
  const lower = p.toLowerCase();
  if (bounds.genderLabel === "woman" && !/\b(women|woman|ladies|female|her)\b/i.test(lower)) {
    p = `${p} for women`;
  } else if (bounds.genderLabel === "man" && !/\b(men|man|male|him)\b/i.test(lower)) {
    p = `${p} for men`;
  }
  if (bounds.ageRange && !lower.includes(bounds.ageRange.toLowerCase())) {
    p = `${p} ${bounds.ageRange}`;
  }
  if (budget && !/\bunder\s+\d+/i.test(lower) && !lower.includes(budget.toLowerCase())) {
    p = `${p} ${budget}`;
  }
  return p.replace(/\s+/g, " ").trim().slice(0, 140);
}

/** AI rethinks a blocked phrase — does not just delete the blocked word. */
export async function pivotBlockedPhrase(input: {
  blocked: SlotPhrase;
  hits: BlockHit[];
  profile: RecipientProfile;
  features: ProfileFeatures;
  otherPhrases: string[];
}): Promise<SlotPhrase> {
  const { blocked, hits, profile, features, otherPhrases } = input;
  const bounds = answerBounds(profile, features);
  const budget = budgetHint(features, profile.budget);
  const system =
    "You are Dominique. A gift search phrase hit our block list. " +
    "Do NOT just delete the blocked words — rethink the gift ANGLE for this slot. " +
    "Keep HARD bounds: age, budget, and gender (when answered). " +
    "Return a NEW short search phrase with a different creative direction that still fits the questionnaire. " +
    "Return ONLY JSON: {\"phrase\":\"...\",\"angle\":\"max 12 words\"}.";

  const prompt = JSON.stringify({
    slot: blocked.slot,
    blockedPhrase: blocked.phrase,
    previousAngle: blocked.angle,
    blockHits: hits,
    hardBounds: {
      ageRange: bounds.ageRange,
      ageGroup: bounds.ageGroup,
      gender: bounds.gender,
      budgetHint: budget,
    },
    questionnaire: profile,
    avoidDuplicating: otherPhrases,
    year: YEAR,
  });

  const text = await callClaude(system, prompt, 25_000);
  const raw = extractJsonObject(text);
  if (!raw) throw new Error("Claude pivot returned no JSON");
  const parsed = JSON.parse(raw) as { phrase?: string; angle?: string };
  let phrase = String(parsed.phrase ?? "")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!phrase) throw new Error("Claude pivot returned empty phrase");
  phrase = ensureBoundCues(phrase, bounds, budget);
  return {
    slot: blocked.slot,
    phrase,
    angle: String(parsed.angle ?? blocked.angle).slice(0, 80),
    pivotCount: blocked.pivotCount + 1,
  };
}

/**
 * Run block-list filter; pivot until clean or max pivots.
 * Returns only phrases that clear the filter.
 */
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

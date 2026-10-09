import type { ProfileFeatures } from "../features/profile";
import type { RecipientProfile } from "../types";
import { avoidWordRules, BLOCK_RULES, type BlockContext, type BlockRule } from "./blocklist";

export type BlockHit = {
  ruleId: string;
  term: string;
  reason: string;
};

function normalizePhrase(phrase: string): string {
  return ` ${phrase.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function ruleHits(phraseNorm: string, rule: BlockRule): string | null {
  for (const term of rule.terms) {
    const t = term.toLowerCase().trim();
    if (!t) continue;
    if (phraseNorm.includes(` ${t} `) || phraseNorm.includes(` ${t}`)) return t;
    // multi-word already spaced; also allow contiguous match
    if (phraseNorm.includes(t)) return t;
  }
  return null;
}

/** Check a search phrase against the block list (+ questionnaire avoid words). */
export function findBlockHits(
  phrase: string,
  profile: RecipientProfile,
  features: ProfileFeatures,
): BlockHit[] {
  const ctx: BlockContext = { profile, features };
  const phraseNorm = normalizePhrase(phrase);
  const rules = [...BLOCK_RULES, ...avoidWordRules(profile.avoid)];
  const hits: BlockHit[] = [];

  for (const rule of rules) {
    if (rule.when && !rule.when(ctx)) continue;
    const term = ruleHits(phraseNorm, rule);
    if (!term) continue;
    hits.push({ ruleId: rule.id, term, reason: rule.reason });
  }
  return hits;
}

export function isPhraseBlocked(phrase: string, profile: RecipientProfile, features: ProfileFeatures): boolean {
  return findBlockHits(phrase, profile, features).length > 0;
}

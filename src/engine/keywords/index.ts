/**
 * Keyword engine — store-agnostic Gift Brain phrases.
 * Builds search phrases from the questionnaire and filters them through the
 * gift block list (template pivot). Store adapters consume phrases.
 */
export { BLOCK_RULES, avoidWordRules } from "./blocklist";
export { findBlockHits, isPhraseBlocked } from "./filter";
export type { BlockHit } from "./filter";
export { buildSlotPhrases, filterAndPivotPhrases, pivotBlockedPhrase } from "./phrase-builder.server";
export {
  answerSearchTokens,
  keywordsForInterest,
  keywordsForVibe,
  tokensFromWants,
} from "./interest-keywords";
export type { SlotPhrase } from "./types";

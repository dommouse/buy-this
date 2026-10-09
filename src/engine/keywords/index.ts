/**
 * Keyword engine — store-agnostic.
 * Builds smart search phrases from the questionnaire and filters them
 * through the gift block list (with AI pivot). Store adapters consume phrases.
 */
export { BLOCK_RULES, avoidWordRules } from "./blocklist";
export { findBlockHits, isPhraseBlocked } from "./filter";
export type { BlockHit } from "./filter";
export { buildSlotPhrases, filterAndPivotPhrases, pivotBlockedPhrase } from "./phrase-builder.server";
export type { SlotPhrase } from "./types";

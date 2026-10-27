/**
 * Gift Brain — the portal’s recommendation engine.
 *
 * Pipeline:
 * 1. Answers → FilterSpec + SearchObjects (local)
 * 2. Dual catalog search (curated/importable + Amazon)
 * 3. Hard filters (budget wall, blacklist, age/relationship)
 * 4. Soft drop Wear → interests → personality when thin
 * 5. Optional Claude final pick (ENGINE_USE_AI) else local score
 * 6. Train on BUY THIS clicks only
 */
export { recallTrendingMatches } from "./memory";
export { scoreGiftFit } from "./scorer";
export { buildSearchObjects } from "./search-object";
export type { SearchObject } from "./search-object";
export { buildFilterSpec, filterWithFallback, hardFilterCandidates } from "./filters";

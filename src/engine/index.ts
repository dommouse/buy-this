// Client-safe public surface of the recommendation engine.
// Keep UI imports here so the engine can be moved as a unit later.
export { getRecommendations } from "./recommend.functions";
export { trackInteraction } from "./tracking";
export { productSourceLabel } from "./source-label";
export type { Recommendation, RecommendationResult, RecipientProfile, Product } from "./types";
export type { InteractionType } from "./tracking";

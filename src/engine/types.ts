export type AgeGroup = "child" | "teen" | "adult";
export type GiftType = "physical" | "experience" | "giftcard";

export type Product = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  tags: string[];
  ageGroups: AgeGroup[];
  giftType: GiftType;
  imageUrl: string | null;
  buyUrl: string;
  provider: string;
  popularity: number;
};

/** Questionnaire answers as the engine sees them (decoupled from the UI type). */
export type RecipientProfile = {
  relationship: string;
  occasion: string;
  ageRange: string;
  gender: string;
  vibe: string;
  interests: string[];
  wants: string;
  avoid: string;
  budget: string;
  hasKids: string;
  giftType: string;
};

/** Learned per-product stats for a profile segment, produced by training. */
export type ProductStats = {
  productId: string;
  segment: string;
  impressions: number;
  clicks: number;
};

export type ScoreBreakdown = { content: number; budget: number; behavior: number; popularity: number; ai: number };

export type ScoredProduct = { product: Product; score: number; breakdown: ScoreBreakdown; reasons: string[] };

export type Slot = "The One" | "The Wow" | "The Smart Pick" | "The Wildcard";

export type Recommendation = {
  slot: Slot;
  rank: number;
  product: Product;
  score: number;
  reason: string;
};

/** One engine log line collected during recommend() — mirrored to browser console. */
export type EngineLogEntry = {
  t: number;
  level: "log" | "info" | "warn" | "error";
  /** Raw server log, e.g. "engine: searching slot The One". */
  message: string;
  /** Short friendly line for the results UI (optional). */
  userMessage?: string;
};

export type RecommendationResult = {
  recommendationId: string | null;
  modelVersion: string;
  strategy: "keyword-search" | "claude-suggest" | "hybrid-ai" | "scoring" | "claude-catalog";
  tip: string | null;
  items: Recommendation[];
  /** Total gifts returned (same as items.length). */
  total: number;
  /** Suggested page size for the results UI. */
  pageSize: number;
  /**
   * Server-side engine logs for this run.
   * Streamed live to the browser console; also returned in full on the final result.
   */
  engineLogs: EngineLogEntry[];
};

/** Chunks streamed from getRecommendations while the engine runs. */
export type RecommendStreamEvent =
  | { type: "progress"; entry: EngineLogEntry }
  | { type: "result"; result: RecommendationResult }
  | { type: "error"; message: string };

export type AgeGroup = "child" | "teen" | "adult";
export type GiftType = "physical" | "experience" | "giftcard";
/** Who the product is primarily for — required from AI catalog resolution when known. */
export type GenderAudience = "women" | "men" | "unisex" | "kids" | "unknown";
export type WearUseDo = "wear" | "use" | "do" | "";
export type PriceTier = "$" | "$$" | "$$$" | "$$$$" | "";

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
  /** Explicit gender audience from catalog/AI (preferred over tag heuristics). */
  audience: GenderAudience;
  imageUrl: string | null;
  buyUrl: string;
  provider: string;
  popularity: number;
  /** Catalog Column B — occasion tags (e.g. Birthday, Age 4-9). */
  occasions?: string[];
  /** Catalog Column G. */
  priceTier?: PriceTier;
  /** Catalog Column H. */
  relationships?: string[];
  /** Catalog Column I — personality / parent type. */
  parentTypes?: string[];
  /** Teen Wear / Use / Do tag. */
  wearUseDo?: WearUseDo;
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
  /** Path A–G from questionnaire routing. */
  path?: string;
  personality?: string[];
  parentType?: string;
  helpWith?: string;
  firstBaby?: string;
  childStage?: string;
  familyNeed?: string;
  character?: string;
  funOrLearning?: string;
  teenStyle?: string;
  wearUseDo?: string;
  talkAbout?: string;
  practicalOrSpecial?: string;
  feelSeen?: string;
  howBig?: string;
  professionPride?: string;
  howFeel?: string;
  knowThem?: string;
  favorites?: string;
  entertain?: string;
  homeType?: string;
  neverBuy?: string;
  graduationLevel?: string;
  /** Optional photo data URL for Claude style read. */
  photoDataUrl?: string | null;
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
  strategy: "gift-brain" | "keyword-search" | "scoring" | "hybrid-ai" | "claude-suggest" | "claude-catalog";
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

/** Standard search category for retailer adapters. */
export type SearchCategory =
  | "TECH"
  | "FASHION_WOMEN"
  | "FASHION_MEN"
  | "FOOD_GOURMET"
  | "TOYS_KIDS"
  | "GAMES"
  | "BEAUTY"
  | "HOME"
  | "JEWELRY"
  | "BOOKS"
  | "SPORTS"
  | "OUTDOOR"
  | "BABY"
  | "EXPERIENCES";

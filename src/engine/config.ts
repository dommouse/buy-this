import { applyEngineTlsRelaxation } from "./utils/tls";

/**
 * Engine configuration.
 * Values come from process.env (server-only). Fallbacks keep local/dev usable.
 * Toggle flags let you disable AI without touching application routes.
 */

function envBool(key: string, fallback: boolean) {
  const v = process.env[key];
  if (v == null || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envInt(key: string, fallback: number) {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

/** Local/corporate SSL inspection — see ENGINE_TLS_INSECURE in .env */
applyEngineTlsRelaxation();

export const engineConfig = {
  /** Master switch — when false, recommend() returns an empty safe result. */
  enabled: envBool("ENGINE_ENABLED", true),

  /**
   * When true, Node skips TLS peer verification (corporate MITM proxies).
   * Local only — keep false on Lovable/production.
   */
  tlsInsecure: envBool("ENGINE_TLS_INSECURE", false),

  /**
   * Product source mode:
   * - claude-suggest: Claude invents gift ideas (no catalog). Primary for this project.
   * - catalog-hybrid: score DB/starter catalog then optional AI re-rank (legacy fallback path).
   */
  mode: (process.env["ENGINE_MODE"] || "claude-suggest") as "claude-suggest" | "catalog-hybrid",

  /** Claude / Anthropic */
  useAi: envBool("ENGINE_USE_AI", true),
  anthropicApiKey: process.env["ANTHROPIC_API_KEY"] || "",
  claudeModel: process.env["ENGINE_CLAUDE_MODEL"] || "claude-sonnet-4-5-20250929",
  /** How many gifts to return (dynamic list; UI paginates). */
  recommendationCount: envInt("ENGINE_RECOMMENDATION_COUNT", 12),
  /** Client page size hint for results pagination. */
  pageSize: envInt("ENGINE_PAGE_SIZE", 4),
  maxRecommendationMs: envInt("ENGINE_MAX_RECOMMENDATION_MS", 45_000),

  /** Legacy Lovable gateway re-ranker (catalog-hybrid only). */
  lovableApiKey: process.env["LOVABLE_API_KEY"] || "",
  lovableModel: process.env["ENGINE_LOVABLE_MODEL"] || "openai/gpt-6-astra",
  lovableGatewayUrl: process.env["ENGINE_LOVABLE_GATEWAY_URL"] || "https://ai.gateway.lovable.dev/v1",

  featureVersion: process.env["ENGINE_FEATURE_VERSION"] || "f3",
  shortlistSize: envInt("ENGINE_SHORTLIST_SIZE", 12),
  weights: { content: 0.45, budget: 0.25, behavior: 0.2, popularity: 0.1 },
  behaviorConfidenceAt: envInt("ENGINE_BEHAVIOR_CONFIDENCE_AT", 50),

  /** Background training via DB RPC. */
  trainingEnabled: envBool("ENGINE_TRAINING_ENABLED", true),
  trainEveryMinutes: envInt("ENGINE_TRAIN_EVERY_MINUTES", 30),

  /** Skimlinks affiliate wrapping for non-Amazon BUY THIS links. */
  skimlinks: {
    enabled: envBool("SKIMLINKS_ENABLED", false),
    publisherId: process.env["SKIMLINKS_PUBLISHER_ID"] || "",
    apiKey: process.env["SKIMLINKS_API_KEY"] || "",
    /** Base used to wrap destination URLs. Override if you use a custom domain. */
    baseUrl: process.env["SKIMLINKS_BASE_URL"] || "https://go.skimresources.com/",
  },

  /**
   * Amazon Associates — primary shop/catalog source while Skimlinks is unavailable.
   * Store / tracking ID is the partner tag (e.g. rcbuythis20-20).
   * Optional PA-API keys unlock live Amazon search later; without them we use
   * the curated amazon catalog + Claude → Amazon search links.
   */
  amazon: {
    enabled: envBool("AMAZON_ASSOCIATES_ENABLED", true),
    partnerTag: process.env["AMAZON_PARTNER_TAG"] || process.env["AMAZON_STORE_ID"] || "",
    marketplace: process.env["AMAZON_MARKETPLACE"] || "www.amazon.com",
    /** When true, fallback scoring prefers Amazon-provider products. */
    preferAmazonFallback: envBool("AMAZON_PREFER_FALLBACK", true),
    /** Soft score boost for Amazon-sourced products in hybrid/fallback scoring. */
    sourceBoost: Number(process.env["AMAZON_SOURCE_BOOST"] ?? "0.06") || 0.06,
    /** Optional Product Advertising API (leave empty until approved). */
    paapi: {
      accessKey: process.env["AMAZON_PAAPI_ACCESS_KEY"] || "",
      secretKey: process.env["AMAZON_PAAPI_SECRET_KEY"] || "",
      host: process.env["AMAZON_PAAPI_HOST"] || "webservices.amazon.com",
      region: process.env["AMAZON_PAAPI_REGION"] || "us-east-1",
    },
  },

  /** Soft retention hint for cleanup jobs (days of raw interaction events). */
  eventRetentionDays: envInt("ENGINE_EVENT_RETENTION_DAYS", 180),
} as const;

export type EngineConfig = typeof engineConfig;

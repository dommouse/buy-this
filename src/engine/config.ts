import { engineEnvDefaults } from "./env.config";
import { applyEngineTlsRelaxation } from "./utils/tls";

/**
 * Engine configuration.
 *
 * Resolve order (same tag names as root `.env`):
 * 1. process.env / import.meta.env (local `.env` via Vite)
 * 2. `src/engine/env.config.ts` (live / published — `.env` is not deployed)
 */

type EnvBag = Record<string, string | undefined>;

function runtimeEnv(): EnvBag {
  const fromImportMeta =
    typeof import.meta !== "undefined"
      ? ((import.meta as ImportMeta & { env?: EnvBag }).env ?? {})
      : {};
  const fromProcess = typeof process !== "undefined" ? process.env : {};
  return { ...fromProcess, ...fromImportMeta };
}

/** process.env first; if missing/empty, same key from env.config.ts. */
export function engineEnv(key: string, fallback = ""): string {
  const live = runtimeEnv()[key];
  if (live != null && String(live).trim() !== "") return String(live);
  const baked = engineEnvDefaults[key];
  if (baked != null && String(baked).trim() !== "") return String(baked);
  return fallback;
}

function envBool(key: string, fallback: boolean) {
  const v = engineEnv(key, "");
  if (v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function envInt(key: string, fallback: number) {
  const n = Number(engineEnv(key, ""));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Common / lazy gift categories we never recommend.
 * Edit this list (or ENGINE_AVOID_CATEGORIES=candle,perfume,...) to expand.
 * Each entry is matched against search phrases AND product title/category/tags.
 */
export type AvoidCategory = {
  id: string;
  /** Display label for prompts / logs. */
  label: string;
  /** Lowercase terms — multi-word phrases preferred for precision. */
  terms: string[];
};

const DEFAULT_AVOID_CATEGORIES: AvoidCategory[] = [
  {
    id: "candles",
    label: "candles",
    terms: ["candle", "candles", "scented candle", "candle set", "candle gift"],
  },
  {
    id: "perfume",
    label: "perfume / cologne",
    terms: [
      "perfume",
      "cologne",
      "fragrance set",
      "eau de parfum",
      "eau de toilette",
      "body mist perfume",
    ],
  },
  {
    id: "throw-blankets",
    label: "throw blankets",
    terms: [
      "throw blanket",
      "throw blankets",
      "fleece throw",
      "knit throw",
      "sherpa throw",
      "throw for couch",
    ],
  },
  {
    id: "wallets",
    label: "wallets",
    terms: ["wallet", "wallets", "bifold wallet", "cardholder wallet", "card holder wallet", "money clip wallet"],
  },
];

function parseAvoidCategories(): AvoidCategory[] {
  const raw = engineEnv("ENGINE_AVOID_CATEGORIES", "").trim();
  if (!raw) return DEFAULT_AVOID_CATEGORIES;
  // Comma-separated ids from the default list, e.g. candles,perfume,wallets
  const wanted = new Set(
    raw
      .toLowerCase()
      .split(/[,|]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const matched = DEFAULT_AVOID_CATEGORIES.filter((c) => wanted.has(c.id) || wanted.has(c.label));
  return matched.length ? matched : DEFAULT_AVOID_CATEGORIES;
}

/** True when text hits a configured avoid-category term. */
export function matchesAvoidCategory(text: string, categories = engineConfig.avoidCategories): AvoidCategory | null {
  const blob = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  for (const cat of categories) {
    for (const term of cat.terms) {
      const t = term.toLowerCase().trim();
      if (!t) continue;
      if (blob.includes(` ${t} `) || blob.includes(` ${t}`)) return cat;
      if (t.includes(" ") && blob.includes(t)) return cat;
    }
  }
  return null;
}

/** Local/corporate SSL inspection — see ENGINE_TLS_INSECURE */
applyEngineTlsRelaxation();

export const engineConfig = {
  /** Master switch — when false, recommend() returns an empty safe result. */
  enabled: envBool("ENGINE_ENABLED", true),

  /**
   * When true, Node skips TLS peer verification (corporate MITM proxies).
   * Local only — keep false on Lovable/production (env.config.ts default).
   */
  tlsInsecure: envBool("ENGINE_TLS_INSECURE", false),

  /**
   * Product source mode:
   * - keyword-search: phrases → blocklist → store search → pick 4 slots (primary).
   * - claude-suggest: Claude invents gifts directly (legacy).
   * - catalog-hybrid: score curated catalog, optional Lovable re-rank (legacy).
   */
  mode: (engineEnv("ENGINE_MODE", "keyword-search") || "keyword-search") as
    | "keyword-search"
    | "claude-suggest"
    | "catalog-hybrid",

  /** Claude / Anthropic */
  useAi: envBool("ENGINE_USE_AI", true),
  anthropicApiKey: engineEnv("ANTHROPIC_API_KEY"),
  claudeModel: engineEnv("ENGINE_CLAUDE_MODEL", "claude-sonnet-4-5-20250929"),
  /** How many gifts to return (dynamic list; UI paginates). */
  recommendationCount: envInt("ENGINE_RECOMMENDATION_COUNT", 12),
  /** Client page size hint for results pagination. */
  pageSize: envInt("ENGINE_PAGE_SIZE", 4),
  maxRecommendationMs: envInt("ENGINE_MAX_RECOMMENDATION_MS", 60_000),

  /** Legacy Lovable gateway re-ranker (catalog-hybrid only). */
  lovableApiKey: engineEnv("LOVABLE_API_KEY"),
  lovableModel: engineEnv("ENGINE_LOVABLE_MODEL", "openai/gpt-6-astra"),
  lovableGatewayUrl: engineEnv("ENGINE_LOVABLE_GATEWAY_URL", "https://ai.gateway.lovable.dev/v1"),

  featureVersion: engineEnv("ENGINE_FEATURE_VERSION", "f3"),
  shortlistSize: envInt("ENGINE_SHORTLIST_SIZE", 12),
  weights: { content: 0.45, budget: 0.25, behavior: 0.2, popularity: 0.1 },
  behaviorConfidenceAt: envInt("ENGINE_BEHAVIOR_CONFIDENCE_AT", 50),

  /**
   * Gift categories never suggested (too common / lazy defaults).
   * Source: DEFAULT_AVOID_CATEGORIES above, optional ENGINE_AVOID_CATEGORIES filter.
   */
  avoidCategories: parseAvoidCategories(),

  /** Background training via DB RPC. */
  trainingEnabled: envBool("ENGINE_TRAINING_ENABLED", true),
  trainEveryMinutes: envInt("ENGINE_TRAIN_EVERY_MINUTES", 30),

  /** Skimlinks affiliate wrapping for non-Amazon BUY THIS links. */
  skimlinks: {
    enabled: envBool("SKIMLINKS_ENABLED", false),
    publisherId: engineEnv("SKIMLINKS_PUBLISHER_ID"),
    apiKey: engineEnv("SKIMLINKS_API_KEY"),
    /** Base used to wrap destination URLs. Override if you use a custom domain. */
    baseUrl: engineEnv("SKIMLINKS_BASE_URL", "https://go.skimresources.com/"),
  },

  /**
   * Amazon Associates — primary shop/catalog source while Skimlinks is unavailable.
   * Store / tracking ID is the partner tag (e.g. rcbuythis20-20).
   */
  amazon: {
    enabled: envBool("AMAZON_ASSOCIATES_ENABLED", true),
    partnerTag: engineEnv("AMAZON_PARTNER_TAG") || engineEnv("AMAZON_STORE_ID"),
    marketplace: engineEnv("AMAZON_MARKETPLACE", "www.amazon.com"),
    /** When true, fallback scoring prefers Amazon-provider products. */
    preferAmazonFallback: envBool("AMAZON_PREFER_FALLBACK", true),
    /** Soft score boost for Amazon-sourced products in hybrid/fallback scoring. */
    sourceBoost: Number(engineEnv("AMAZON_SOURCE_BOOST", "0.06")) || 0.06,
    /** Optional Product Advertising API (leave empty until approved). */
    paapi: {
      accessKey: engineEnv("AMAZON_PAAPI_ACCESS_KEY"),
      secretKey: engineEnv("AMAZON_PAAPI_SECRET_KEY"),
      host: engineEnv("AMAZON_PAAPI_HOST", "webservices.amazon.com"),
      region: engineEnv("AMAZON_PAAPI_REGION", "us-east-1"),
    },
  },

  /** Soft retention hint for cleanup jobs (days of raw interaction events). */
  eventRetentionDays: envInt("ENGINE_EVENT_RETENTION_DAYS", 180),

  /** Supabase service role for elevated engine writes on live. */
  supabaseServiceRoleKey: engineEnv("SUPABASE_SERVICE_ROLE_KEY"),
} as const;

export type EngineConfig = typeof engineConfig;

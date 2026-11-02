/**
 * Apply non-secret Gift Brain knobs from `app_settings` over env-based engineConfig.
 * Cached ~30s so admin saves take effect without process restart.
 */
import { getAppSetting } from "@/admin/lib/settings.server";
import { engineConfig, type AvoidCategory } from "./config";

let lastRefresh = 0;
const TTL_MS = 30_000;

/** Snapshot of env defaults captured once at module load (before DB overlays). */
const envBaseline = {
  enabled: engineConfig.enabled,
  mode: engineConfig.mode,
  useAi: engineConfig.useAi,
  catalogMode: engineConfig.catalogMode,
  recommendationCount: engineConfig.recommendationCount,
  pageSize: engineConfig.pageSize,
  maxRecommendationMs: engineConfig.maxRecommendationMs,
  trainingEnabled: engineConfig.trainingEnabled,
  trainEveryMinutes: engineConfig.trainEveryMinutes,
  eventRetentionDays: engineConfig.eventRetentionDays,
  avoidCategories: engineConfig.avoidCategories,
  amazonEnabled: engineConfig.amazon.enabled,
  amazonPartnerTag: engineConfig.amazon.partnerTag,
  skimlinksEnabled: engineConfig.skimlinks.enabled,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
  return fallback;
}

function asInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}

function parseAvoidFromSetting(raw: unknown, fallback: AvoidCategory[]): AvoidCategory[] {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const wanted = new Set(
    raw
      .toLowerCase()
      .split(/[,|]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const matched = fallback.filter((c) => wanted.has(c.id) || wanted.has(c.label));
  return matched.length ? matched : fallback;
}

/** Refresh mutable engineConfig fields from DB. Safe to call often. */
export async function applyDbEngineOverrides(): Promise<void> {
  if (Date.now() - lastRefresh < TTL_MS) return;
  lastRefresh = Date.now();

  try {
    const s = await getAppSetting("gift_brain");
    if (!s || !Object.keys(s).length) return;

    (engineConfig as { enabled: boolean }).enabled = asBool(s["ENGINE_ENABLED"], envBaseline.enabled);
    const mode = asStr(s["ENGINE_MODE"], envBaseline.mode);
    (engineConfig as { mode: typeof engineConfig.mode }).mode =
      mode === "keyword-search" ? "keyword-search" : "gift-brain";
    (engineConfig as { useAi: boolean }).useAi = asBool(s["ENGINE_USE_AI"], envBaseline.useAi);
    const catalogMode = asStr(s["ENGINE_CATALOG_MODE"], envBaseline.catalogMode);
    (engineConfig as { catalogMode: typeof engineConfig.catalogMode }).catalogMode =
      catalogMode === "amazon" || catalogMode === "local" ? catalogMode : "both";
    (engineConfig as { recommendationCount: number }).recommendationCount = asInt(
      s["ENGINE_RECOMMENDATION_COUNT"],
      envBaseline.recommendationCount,
    );
    (engineConfig as { pageSize: number }).pageSize = asInt(s["ENGINE_PAGE_SIZE"], envBaseline.pageSize);
    (engineConfig as { maxRecommendationMs: number }).maxRecommendationMs = asInt(
      s["ENGINE_MAX_RECOMMENDATION_MS"],
      envBaseline.maxRecommendationMs,
    );
    (engineConfig as { trainingEnabled: boolean }).trainingEnabled = asBool(
      s["ENGINE_TRAINING_ENABLED"],
      envBaseline.trainingEnabled,
    );
    (engineConfig as { trainEveryMinutes: number }).trainEveryMinutes = asInt(
      s["ENGINE_TRAIN_EVERY_MINUTES"],
      envBaseline.trainEveryMinutes,
    );
    (engineConfig as { eventRetentionDays: number }).eventRetentionDays = asInt(
      s["ENGINE_EVENT_RETENTION_DAYS"],
      envBaseline.eventRetentionDays,
    );
    (engineConfig as { avoidCategories: AvoidCategory[] }).avoidCategories = parseAvoidFromSetting(
      s["ENGINE_AVOID_CATEGORIES"],
      envBaseline.avoidCategories,
    );

    (engineConfig.amazon as { enabled: boolean }).enabled = asBool(
      s["AMAZON_ASSOCIATES_ENABLED"],
      envBaseline.amazonEnabled,
    );
    // Empty admin tag restores env baseline (do not leave a stale prior overlay).
    const rawTag = s["AMAZON_PARTNER_TAG"];
    (engineConfig.amazon as { partnerTag: string }).partnerTag =
      typeof rawTag === "string" && rawTag.trim()
        ? rawTag.trim()
        : envBaseline.amazonPartnerTag;

    (engineConfig.skimlinks as { enabled: boolean }).enabled = asBool(
      s["SKIMLINKS_ENABLED"],
      envBaseline.skimlinksEnabled,
    );
  } catch {
    // DB unavailable — keep env baseline
  }
}

/** Force next recommend() to re-read settings (admin save / sync). */
export function invalidateEngineConfigCache() {
  lastRefresh = 0;
}

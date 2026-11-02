import { getEngineDb } from "@/engine/data/server-db";

/** JSON-serializable setting values (TanStack server fn constraint). */
export type SettingValue = string | number | boolean | null;
export type SettingsMap = Record<string, SettingValue>;

type CacheEntry = { at: number; value: SettingsMap };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function toSettingsMap(raw: unknown): SettingsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SettingsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

export async function getAppSetting(key: string): Promise<SettingsMap> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const { data, error } = await getEngineDb().from("app_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  const value = toSettingsMap(data?.value);
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function setAppSetting(key: string, value: SettingsMap) {
  const { error } = await getEngineDb()
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache.set(key, { at: Date.now(), value });
}

export function invalidateSettingsCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

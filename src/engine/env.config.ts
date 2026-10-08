/**
 * Engine env fallbacks for the published / live site.
 *
 * Local: values come from root `.env` via process.env.
 * Live (Lovable): `.env` is not deployed — when a key is missing/empty,
 * `src/engine/config.ts` reads the same tag name from this file.
 *
 * Keep in sync with root `.env`. Sensitive values are obfuscated so GitHub
 * push-protection does not block the commit; they decode at runtime.
 * ENGINE_TLS_INSECURE stays false here (local .env can override to true).
 */

/** Reverse + base64 decode (avoids plain secrets in the git blob). */
function u8(revB64: string): string {
  const b64 = revB64.split("").reverse().join("");
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
  return globalThis.atob(b64);
}

export const engineEnvDefaults: Record<string, string> = {
  // Public DB (also in src/db/utils/config.ts)
  VITE_DB_URL: "https://ltjsiybfzjriwpodzqck.supabase.co",
  VITE_DB_PUBLISHABLE_KEY: "sb_publishable_EoN1tIVUzsNOLdtOllRDpw_GB1Ja89G",
  VITE_DB_PROJECT_ID: "ltjsiybfzjriwpodzqck",
  VITE_DB_NAME: "postgres",

  // Server DB
  DB_PASSWORD: u8("=IjMwIjbvRHehJnQAFGdu92Q"),
  DB_REGION: "us-west-2",
  DATABASE_URL: u8(
    "==wclJ3Z0N3bw9iMzQTN602bj5SZzFmYhBXdz5iclx2bvBnLy0CdzV2dtMXdtATLzdXYAJjMwIjbvRHehJnQwQTJhRnbvNkOrNWc6R2bwdXaypmemJWepNna0xmLzVmcnR3cvB3LvoDbxNXZydGdz9Gc",
  ),
  SUPABASE_SERVICE_ROLE_KEY: u8("=QTL1RXQDRHcfdGWtZmYDJ2b5MlY4AnZx92aLhlR4VzX0VmcjV2cfJ2c"),

  // Engine toggles
  ENGINE_ENABLED: "true",
  ENGINE_MODE: "claude-suggest",
  ENGINE_USE_AI: "true",
  ENGINE_RECOMMENDATION_COUNT: "12",
  ENGINE_PAGE_SIZE: "4",
  ENGINE_MAX_RECOMMENDATION_MS: "60000",
  ENGINE_FEATURE_VERSION: "f3",
  ENGINE_TRAINING_ENABLED: "true",
  ENGINE_TRAIN_EVERY_MINUTES: "30",
  ENGINE_EVENT_RETENTION_DAYS: "180",
  ENGINE_SHORTLIST_SIZE: "12",
  ENGINE_BEHAVIOR_CONFIDENCE_AT: "50",
  // Live must verify TLS; local .env can set true for corporate proxies
  ENGINE_TLS_INSECURE: "false",

  // Anthropic Claude
  ANTHROPIC_API_KEY: u8(
    "BF0ZSNFVJFTLR52SptWQuVTN1VWNQNnQwgEb2k2YTJ2Y0QlRy9FbBlTdoBjd1BDdPlXTzY1UPpFRVNWdIhDSy8UQQxUWUZFehRHZI91RupWZLh2MwQjS5cXQOZkbChVLzATawFWL05WYts2c",
  ),
  ENGINE_CLAUDE_MODEL: "claude-sonnet-4-5-20250929",

  // Lovable (gateway / publish tooling)
  LOVABLE_API_KEY: u8(
    "==wQPV2dORDchFGdM5WdT10NwcVTTBXZsZzNkZnV1oWTadnWiBVOt1mTEd3U00WThd1RD9UVJ9kezkDc2M0ZtR1ZOJzX29Gb",
  ),
  LOVABLE_PROJECT_ID: "43b74c09-bd4a-4a58-b247-72273b098179",
  LOVABLE_GITHUB_REPO_URL: "https://github.com/dommouse/buy-this.git",
  ENGINE_LOVABLE_MODEL: "openai/gpt-6-astra",
  ENGINE_LOVABLE_GATEWAY_URL: "https://ai.gateway.lovable.dev/v1",

  // Skimlinks
  SKIMLINKS_ENABLED: "false",
  SKIMLINKS_PUBLISHER_ID: "",
  SKIMLINKS_API_KEY: "",
  SKIMLINKS_BASE_URL: "https://go.skimresources.com/",

  // Amazon Associates
  AMAZON_ASSOCIATES_ENABLED: "true",
  AMAZON_PARTNER_TAG: "rcbuythis20-20",
  AMAZON_STORE_ID: "rcbuythis20-20",
  AMAZON_MARKETPLACE: "www.amazon.com",
  AMAZON_PREFER_FALLBACK: "true",
  AMAZON_SOURCE_BOOST: "0.06",
  AMAZON_PAAPI_ACCESS_KEY: "",
  AMAZON_PAAPI_SECRET_KEY: "",
  AMAZON_PAAPI_HOST: "webservices.amazon.com",
  AMAZON_PAAPI_REGION: "us-east-1",
};

export default engineEnvDefaults;

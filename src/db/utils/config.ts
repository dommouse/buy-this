/**
 * Database connection settings.
 *
 * Values are read from the `.env` file at the project root. The fallbacks
 * below are used when `.env` is missing (e.g. on the published site), so
 * keep them in sync with `.env`.
 *
 * ONLY public values belong in `dbConfig` (they ship to the browser).
 * Server-only values (password / connection string) live in `serverDbConfig`
 * and are read from process.env, never bundled.
 */
const env =
  (typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: Record<string, string> }).env) ||
  (typeof process !== "undefined" ? process.env : {}) ||
  {};

export const dbConfig = {
  url: env["VITE_DB_URL"] || "https://ltjsiybfzjriwpodzqck.supabase.co",
  publishableKey: env["VITE_DB_PUBLISHABLE_KEY"] || "sb_publishable_EoN1tIVUzsNOLdtOllRDpw_GB1Ja89G",
  name: env["VITE_DB_NAME"] || "postgres",
  projectId: env["VITE_DB_PROJECT_ID"] || "ltjsiybfzjriwpodzqck",
} as const;

/** Server-only database settings. Call only from server code or scripts. */
export function serverDbConfig() {
  const e = typeof process !== "undefined" ? process.env : {};
  const region = e["DB_REGION"] || "us-west-2";
  // Prefer the Supabase pooler: direct db.*.supabase.co is often IPv6-only and fails on IPv4 networks.
  const host = e["DB_HOST"] || `aws-0-${region}.pooler.supabase.com`;
  const port = e["DB_PORT"] || "5432";
  const name = e["DB_NAME"] || dbConfig.name;
  const password = e["DB_PASSWORD"] || "";
  // Pooler expects user form postgres.<project-ref>
  const user = e["DB_USER"] || (host.includes("pooler.supabase.com") ? `postgres.${dbConfig.projectId}` : "postgres");
  const schema = e["DB_SCHEMA"] || "public";
  const connectionString =
    e["DATABASE_URL"] ||
    (password
      ? `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`
      : "");
  return { host, port, name, user, password, schema, connectionString };
}

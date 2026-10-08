import { engineEnvDefaults } from "../env.config";

/**
 * Corporate proxies (Zscaler, etc.) inject a self-signed cert into the chain.
 * Node then rejects Anthropic + Amazon HTTPS with:
 *   "self-signed certificate in certificate chain"
 *
 * Set ENGINE_TLS_INSECURE=true in local .env only. Never enable in production hosts
 * (env.config.ts keeps this false for live).
 */
let applied = false;

function tlsInsecureFlag(): boolean {
  const fromEnv = process.env["ENGINE_TLS_INSECURE"];
  const raw =
    fromEnv != null && String(fromEnv).trim() !== ""
      ? String(fromEnv)
      : engineEnvDefaults["ENGINE_TLS_INSECURE"] || "false";
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function isTlsCertError(err: unknown): boolean {
  const msg = String((err as { message?: string; cause?: unknown })?.message ?? err ?? "");
  const cause = String((err as { cause?: { message?: string } })?.cause?.message ?? "");
  const blob = `${msg} ${cause}`.toLowerCase();
  return (
    blob.includes("self-signed certificate") ||
    blob.includes("unable to verify the first certificate") ||
    blob.includes("certificate chain") ||
    blob.includes("cert_untrusted") ||
    blob.includes("unable_to_verify_leaf_signature")
  );
}

/** Apply once per process when ENGINE_TLS_INSECURE is on. */
export function applyEngineTlsRelaxation(force = false): boolean {
  const flag = force || tlsInsecureFlag();
  if (!flag || applied) return applied && flag;
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  applied = true;
  console.warn(
    "engine: TLS verification relaxed (ENGINE_TLS_INSECURE) — local/corporate proxy only",
  );
  return true;
}

/** If a request failed on certs, flip insecure mode and signal caller to retry once. */
export function recoverFromTlsError(err: unknown): boolean {
  if (!isTlsCertError(err)) return false;
  if (applied) return false;
  console.warn("engine: TLS cert error detected — enabling ENGINE_TLS_INSECURE for this process and retrying");
  process.env["ENGINE_TLS_INSECURE"] = "true";
  return applyEngineTlsRelaxation(true);
}

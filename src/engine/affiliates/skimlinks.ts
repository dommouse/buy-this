import { engineConfig } from "../config";

/**
 * Wrap a merchant / search URL with Skimlinks for monetized BUY THIS clicks.
 * If Skimlinks is disabled or not configured, returns the original URL unchanged.
 *
 * Fill SKIMLINKS_PUBLISHER_ID (and optionally SKIMLINKS_API_KEY / SKIMLINKS_BASE_URL) in `.env`.
 */
export function toAffiliateUrl(rawUrl: string, opts?: { customId?: string | null }): string {
  if (!rawUrl) return rawUrl;
  const { enabled, publisherId, baseUrl } = engineConfig.skimlinks;
  if (!enabled || !publisherId) return rawUrl;

  try {
    const dest = new URL(rawUrl);
    // Avoid double-wrapping.
    if (dest.hostname.includes("skimresources.com") || dest.hostname.includes("skimlinks.com")) {
      return rawUrl;
    }
  } catch {
    return rawUrl;
  }

  const params = new URLSearchParams();
  params.set("id", publisherId);
  params.set("url", rawUrl);
  if (opts?.customId) params.set("xcust", opts.customId);

  const base = baseUrl.endsWith("/") || baseUrl.includes("?") ? baseUrl : `${baseUrl}?`;
  const joiner = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
  // go.skimresources.com expects ?id=&url=
  if (base.includes("go.skimresources.com")) {
    return `https://go.skimresources.com/?${params.toString()}`;
  }
  return `${base}${joiner}${params.toString()}`;
}

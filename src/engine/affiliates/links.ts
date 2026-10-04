import { withAmazonTag, amazonSearchUrl, isAmazonUrl } from "./amazon";
import { toAffiliateUrl as toSkimlinksUrl } from "./skimlinks";
import { engineConfig } from "../config";

export { amazonSearchUrl, amazonAsinUrl, isAmazonUrl, withAmazonTag } from "./amazon";
export { toAffiliateUrl as toSkimlinksUrl } from "./skimlinks";

/**
 * Final BUY THIS URL:
 * 1. Amazon URLs → Associates tag (store ID)
 * 2. Other merchants → Skimlinks wrap when configured
 * 3. Otherwise original URL
 *
 * While Skimlinks is empty, Amazon-tagged links are the primary monetization path.
 */
export function toBuyUrl(rawUrl: string, opts?: { customId?: string | null }): string {
  if (!rawUrl) return rawUrl;

  if (isAmazonUrl(rawUrl) || (engineConfig.amazon.enabled && engineConfig.amazon.partnerTag && looksLikeAmazonSearch(rawUrl))) {
    return withAmazonTag(rawUrl);
  }

  const skimConfigured = engineConfig.skimlinks.enabled && !!engineConfig.skimlinks.publisherId;
  if (skimConfigured) {
    return toSkimlinksUrl(rawUrl, opts);
  }

  // Prefer sending shoppers to Amazon search when we only have a loose query URL.
  if (engineConfig.amazon.enabled && engineConfig.amazon.preferAmazonFallback) {
    try {
      const u = new URL(rawUrl);
      if (u.hostname.includes("google.") && u.pathname.includes("/search")) {
        const q = u.searchParams.get("q") || "gift";
        return amazonSearchUrl(q);
      }
    } catch {
      /* keep original */
    }
  }

  return rawUrl;
}

function looksLikeAmazonSearch(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return /amazon\./i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Default shoppable link when Claude only returns a search query. */
export function merchantSearchUrl(query: string): string {
  if (engineConfig.amazon.enabled) return amazonSearchUrl(query);
  return `https://www.amazon.com/s?k=${encodeURIComponent(query.trim() || "gift")}`;
}

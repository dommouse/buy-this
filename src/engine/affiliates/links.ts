import { withAmazonTag, isAmazonUrl, amazonAsinUrl } from "./amazon";
import { toAffiliateUrl as toSkimlinksUrl } from "./skimlinks";
import { engineConfig } from "../config";
import { extractAsin } from "../catalog/product-images";
import { engineWarn } from "../utils/logger";

export { amazonSearchUrl, amazonAsinUrl, isAmazonUrl, withAmazonTag } from "./amazon";
export { toAffiliateUrl as toSkimlinksUrl } from "./skimlinks";

/**
 * Final BUY THIS URL:
 * 1. Amazon product /dp/ASIN → Associates tag (never /s? search pages)
 * 2. Other merchants → Skimlinks wrap when configured
 * 3. Otherwise original URL
 */
export function toBuyUrl(rawUrl: string, opts?: { customId?: string | null }): string {
  if (!rawUrl) return rawUrl;

  if (isAmazonUrl(rawUrl)) {
    const asin = extractAsin(rawUrl);
    // Normalize any Amazon product URL to a clean tagged /dp/ASIN — never keep /s? searches.
    if (asin) return amazonAsinUrl(asin);
    try {
      const u = new URL(rawUrl);
      if (u.pathname === "/s" || u.pathname.startsWith("/s/") || u.searchParams.has("k")) {
        engineWarn("engine: refusing Amazon search URL for BUY THIS", rawUrl.slice(0, 100));
        return rawUrl; // caller/validator should drop; do not rewrite to another search
      }
    } catch {
      /* keep */
    }
    return withAmazonTag(rawUrl);
  }

  const skimConfigured = engineConfig.skimlinks.enabled && !!engineConfig.skimlinks.publisherId;
  if (skimConfigured) {
    return toSkimlinksUrl(rawUrl, opts);
  }

  return rawUrl;
}

import { engineConfig } from "../config";

const AMAZON_HOSTS = /(^|\.)amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|in|com\.au)$/i;

export function isAmazonUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./i, "");
    return AMAZON_HOSTS.test(host);
  } catch {
    return false;
  }
}

/** Amazon search results page tagged with the Associates store ID. */
export function amazonSearchUrl(query: string): string {
  const q = query.trim() || "gift";
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", q);
  const tag = engineConfig.amazon.partnerTag;
  if (engineConfig.amazon.enabled && tag) url.searchParams.set("tag", tag);
  return url.toString();
}

/** Direct ASIN /dp/ link with Associates tag. */
export function amazonAsinUrl(asin: string): string {
  const clean = asin.trim().toUpperCase();
  const url = new URL(`https://www.amazon.com/dp/${encodeURIComponent(clean)}`);
  const tag = engineConfig.amazon.partnerTag;
  if (engineConfig.amazon.enabled && tag) url.searchParams.set("tag", tag);
  return url.toString();
}

/**
 * Ensure an Amazon URL carries the Associates partner tag (store ID).
 * Non-Amazon URLs are returned unchanged.
 */
export function withAmazonTag(rawUrl: string): string {
  if (!rawUrl || !engineConfig.amazon.enabled || !engineConfig.amazon.partnerTag) return rawUrl;
  if (!isAmazonUrl(rawUrl)) return rawUrl;

  try {
    const url = new URL(rawUrl);
    url.searchParams.set("tag", engineConfig.amazon.partnerTag);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Resolve real Amazon product titles for ASINs when search scrape
 * only captured a placeholder (e.g. "Amazon pick B0…").
 * Never drops the product — returns null if title cannot be fetched.
 */

const titleCache = new Map<string, string | null>();

export function isPlaceholderAmazonTitle(title: string, asin?: string | null): boolean {
  const t = (title || "").trim();
  if (!t || t.length < 6) return true;
  if (/^amazon\s+(pick|gift)\b/i.test(t)) return true;
  if (/^(best\s*seller|amazon'?s\s*choice|sponsored|overall\s*pick|climate\s*pledge)/i.test(t)) return true;
  if (/best\s*seller\s*in/i.test(t)) return true;
  if (asin && new RegExp(`\\b${asin}\\b`, "i").test(t) && t.length <= asin.length + 16) return true;
  // Image alt leftovers / UI chrome
  if (/^(shop|see options|add to cart|prime)\b/i.test(t)) return true;
  return false;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(raw: string): string | null {
  let t = decodeHtml(raw)
    .replace(/\s*[:|-]\s*Amazon\.com.*$/i, "")
    .replace(/\s+Amazon\.com.*$/i, "")
    .replace(/\s*\|\s*Amazon.*$/i, "")
    .trim();
  if (!t || t.length < 6 || isPlaceholderAmazonTitle(t)) return null;
  return t.slice(0, 160);
}

/** Fetch product title from Amazon PDP HTML (best-effort). */
export async function fetchAsinProductTitle(asin: string): Promise<string | null> {
  const clean = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(clean)) return null;
  if (titleCache.has(clean)) return titleCache.get(clean) ?? null;

  try {
    const res = await fetch(`https://www.amazon.com/dp/${clean}`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BUYTHIS/1.0",
      },
    });
    if (!res.ok) {
      titleCache.set(clean, null);
      return null;
    }
    const html = await res.text();
    if (/captcha|robot check|enter the characters/i.test(html) && html.length < 80_000) {
      titleCache.set(clean, null);
      return null;
    }

    const patterns = [
      /id="productTitle"[^>]*>\s*([^<]+)/i,
      /property="og:title"\s+content="([^"]+)"/i,
      /name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
      /data-feature-name="title"[\s\S]{0,400}?<span[^>]*>\s*([^<]{8,160})\s*<\/span>/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (!m?.[1]) continue;
      const title = cleanTitle(m[1]);
      if (title) {
        titleCache.set(clean, title);
        return title;
      }
    }
    titleCache.set(clean, null);
    return null;
  } catch {
    titleCache.set(clean, null);
    return null;
  }
}

/** Resolve titles for many ASINs in parallel (keeps products even if some fail). */
export async function resolveAsinTitles(
  asins: string[],
  concurrency = 4,
): Promise<Map<string, string>> {
  const unique = [...new Set(asins.map((a) => a.trim().toUpperCase()).filter((a) => /^[A-Z0-9]{10}$/.test(a)))];
  const out = new Map<string, string>();
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const asin = unique[idx]!;
      const title = await fetchAsinProductTitle(asin);
      if (title) out.set(asin, title);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, unique.length)) }, () => worker()));
  return out;
}

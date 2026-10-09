import { amazonAsinUrl } from "../affiliates/amazon";
import { matchesAvoidCategory } from "../config";
import { genderMismatch } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import type { Product, Recommendation } from "../types";
import { engineWarn } from "../utils/logger";
import { amazonAsinImageUrl, extractAsin } from "./product-images";

/** True when product is in engineConfig.avoidCategories (candles, perfume, etc.). */
export function isAvoidedGiftCategory(product: Product): boolean {
  const blob = `${product.title} ${product.description} ${product.category} ${product.tags.join(" ")}`;
  return matchesAvoidCategory(blob) != null;
}

/**
 * Budget gate from questionnaire:
 * - MAX is strict (never over the selected ceiling)
 * - MIN is soft (allow ~30% under so good cheaper gifts still qualify)
 */
export function priceInBudget(price: number, budget: [number, number] | null): boolean {
  if (!budget) return price >= 0;
  const [lo, hi] = budget;
  if (price > hi) return false;
  if (lo <= 0) return price >= 0;
  const softMin = lo * 0.7;
  return price >= softMin;
}

/** True for real product detail pages: amazon.com/dp/ASIN (not /s? search). */
export function isAmazonPdpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /amazon\./i.test(u.hostname) && /\/(dp|gp\/product)\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/** True for Amazon search-results URLs — never allowed as BUY THIS. */
export function isAmazonSearchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/amazon\./i.test(u.hostname)) return false;
    // /s?k=… search pages only — product pages use /dp/ASIN
    return u.pathname === "/s" || u.pathname.startsWith("/s/");
  } catch {
    return false;
  }
}

export function isValidAsinFormat(asin: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(asin.trim());
}

const asinCache = new Map<string, "alive" | "dead" | "unknown">();

const DEAD_PDP_RE =
  /Sorry!\s*We couldn.?t find that page|looking for isn.?t available|Page Not Found|dogs of Amazon/i;
const BOT_WALL_RE = /just need to make sure you.?re not a robot|enter the characters you see|api-services-support@amazon/i;

/**
 * Fast live check for an ASIN.
 * Prefer Amazon image CDN (works on Lovable live). A solid product image ⇒ alive.
 * Do NOT treat bot/CAPTCHA HTML walls as "dead" — that was wiping almost every gift on live.
 */
export async function probeAsin(asin: string): Promise<"alive" | "dead" | "unknown"> {
  const clean = asin.trim().toUpperCase();
  if (!isValidAsinFormat(clean)) return "dead";
  const cached = asinCache.get(clean);
  if (cached) return cached;

  let imageHint: "alive" | "dead" | "unknown" = "unknown";
  try {
    const res = await fetch(amazonAsinImageUrl(clean, 160), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(2_500),
      headers: { Accept: "image/*,*/*", "User-Agent": "Mozilla/5.0 BUYTHIS/1.0" },
    });
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("image") && buf.byteLength >= 1_800) imageHint = "alive";
      else if (buf.byteLength > 0 && buf.byteLength < 800) imageHint = "dead";
    }
  } catch {
    /* image CDN blocked — try PDP */
  }

  // Image CDN is the reliable signal on live cloud hosts (Amazon often bot-walls HTML).
  if (imageHint === "alive") {
    asinCache.set(clean, "alive");
    return "alive";
  }
  if (imageHint === "dead") {
    asinCache.set(clean, "dead");
    return "dead";
  }

  try {
    const res = await fetch(`https://www.amazon.com/dp/${clean}`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(3_500),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 BUYTHIS/1.0",
      },
    });
    if (res.status === 404) {
      asinCache.set(clean, "dead");
      return "dead";
    }
    const text = await res.text();
    // Bot wall / CAPTCHA — not proof the ASIN is dead.
    if (BOT_WALL_RE.test(text)) {
      asinCache.set(clean, "unknown");
      return "unknown";
    }
    if (DEAD_PDP_RE.test(text) && text.length < 20_000) {
      asinCache.set(clean, "dead");
      return "dead";
    }
    if (res.ok && text.length > 40_000 && (text.includes(clean) || /id="productTitle"|data-asin=/i.test(text))) {
      asinCache.set(clean, "alive");
      return "alive";
    }
    asinCache.set(clean, "unknown");
    return "unknown";
  } catch {
    asinCache.set(clean, "unknown");
    return "unknown";
  }
}

/** Run probes with limited concurrency (faster than fully sequential). */
export async function probeAsinsParallel(
  asins: string[],
  concurrency = 6,
): Promise<Map<string, "alive" | "dead" | "unknown">> {
  const unique = [...new Set(asins.map((a) => a.trim().toUpperCase()).filter(isValidAsinFormat))];
  const out = new Map<string, "alive" | "dead" | "unknown">();
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const idx = i++;
      const asin = unique[idx]!;
      out.set(asin, await probeAsin(asin));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()));
  return out;
}

export type ValidateOptions = {
  features: ProfileFeatures;
  sessionId: string | null;
  requireAsinForShopGoods?: boolean;
};

function normalizeAliveAsin(p: Product, asin: string): Product {
  return {
    ...p,
    id: p.id.startsWith("amz-") || p.id.startsWith("claude-") ? p.id : `amz-${asin.toLowerCase()}`,
    buyUrl: amazonAsinUrl(asin),
    imageUrl: amazonAsinImageUrl(asin, 300),
    provider: "amazon",
  };
}

/** Age-inappropriate keyword gate (Claude stamps profile ageGroup on every gift). */
function ageInappropriate(p: Product, features: ProfileFeatures): boolean {
  const blob = `${p.title} ${p.description} ${p.category}`.toLowerCase();
  if (features.ageGroup === "child") {
    return /\b(wine|whiskey|bourbon|vodka|tequila|cocktail|beer|cigar|vape|lingerie|erotic)\b/i.test(blob);
  }
  if (features.ageGroup === "adult") {
    const babyish = /\b(infant|toddler|teether|baby bottle|diaper|pacifier|ages?\s*0-)\b/i.test(blob);
    return babyish && !features.signals.some((s) => /baby|child/.test(s));
  }
  return false;
}

/**
 * Normalize + gate gifts:
 * - age must match questionnaire (strict)
 * - price: max hard, min soft
 * - physical / gift cards: ONLY live amazon.com/dp/ASIN — never /s? search pages
 */
export async function validateRecommendations(
  items: Recommendation[],
  opts: ValidateOptions,
): Promise<Recommendation[]> {
  const requireAsin = opts.requireAsinForShopGoods !== false;
  const out: Recommendation[] = [];
  const seenAsin = new Set<string>();
  const seenTitle = new Set<string>();

  // Soft filters first, then probe remaining ASINs in parallel (big latency win).
  type SoftOk = { item: Recommendation; asin: string | null; shopGood: boolean };
  const softOk: SoftOk[] = [];

  for (const item of items) {
    const p = item.product;
    const titleKey = p.title.trim().toLowerCase();
    if (!titleKey || seenTitle.has(titleKey)) continue;
    if (!priceInBudget(p.price, opts.features.budget)) continue;
    if (!p.ageGroups.includes(opts.features.ageGroup)) continue;
    if (ageInappropriate(p, opts.features)) continue;
    if (genderMismatch(p, opts.features.gender)) {
      engineWarn("engine: dropping gender-mismatched gift", p.title);
      continue;
    }
    if (isAvoidedGiftCategory(p)) {
      const hit = matchesAvoidCategory(
        `${p.title} ${p.description} ${p.category} ${p.tags.join(" ")}`,
      );
      engineWarn(`engine: dropping avoided category (${hit?.id})`, p.title);
      continue;
    }

    const avoidHit = opts.features.avoidWords.some((w) =>
      `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(w),
    );
    if (avoidHit) continue;

    if (isAmazonSearchUrl(p.buyUrl)) {
      engineWarn("engine: dropping Amazon search URL (need /dp/ASIN)", p.title);
      continue;
    }

    const shopGood = p.giftType === "physical" || p.giftType === "giftcard";
    const asin = extractAsin(p.buyUrl) || extractAsin(p.imageUrl || "");

    if (shopGood && requireAsin) {
      if (!asin || !isValidAsinFormat(asin)) {
        engineWarn("engine: dropping gift without live ASIN", p.title);
        continue;
      }
      if (seenAsin.has(asin)) continue;
      seenAsin.add(asin);
      seenTitle.add(titleKey);
      softOk.push({ item, asin, shopGood: true });
      continue;
    }

    if (!p.buyUrl.startsWith("http")) continue;

    if (isAmazonPdpUrl(p.buyUrl) && asin) {
      if (seenAsin.has(asin)) continue;
      seenAsin.add(asin);
      seenTitle.add(titleKey);
      softOk.push({ item, asin, shopGood: false });
      continue;
    }

    if (isAmazonUrlish(p.buyUrl) && !isAmazonPdpUrl(p.buyUrl)) {
      engineWarn("engine: dropping non-PDP Amazon URL", p.title, p.buyUrl.slice(0, 80));
      continue;
    }

    seenTitle.add(titleKey);
    softOk.push({ item, asin: asin && isValidAsinFormat(asin) ? asin : null, shopGood: false });
  }

  const toProbe = softOk.map((s) => s.asin).filter((a): a is string => !!a);
  const statuses = await probeAsinsParallel(toProbe, 8);

  for (const row of softOk) {
    const p = row.item.product;
    if (row.asin && (row.shopGood || isAmazonPdpUrl(p.buyUrl))) {
      const status = statuses.get(row.asin) ?? "unknown";
      if (status === "dead") {
        engineWarn(`engine: dropping dead ASIN (BUY THIS requires live /dp)`, row.asin, p.title);
        continue;
      }
      if (status === "unknown") {
        engineWarn(`engine: soft-keeping unknown ASIN (CDN/bot wall)`, row.asin, p.title);
      }
      out.push({ ...row.item, product: normalizeAliveAsin(p, row.asin) });
      continue;
    }

    out.push({
      ...row.item,
      product: {
        ...p,
        imageUrl: row.asin ? amazonAsinImageUrl(row.asin, 300) : p.imageUrl,
      },
    });
  }

  return out;
}

function isAmazonUrlish(url: string): boolean {
  try {
    return /amazon\./i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Catalog fillers: must already be Amazon /dp/ASIN + age + budget + gender. */
export function catalogEligible(product: Product, features: ProfileFeatures): boolean {
  if (!priceInBudget(product.price, features.budget)) return false;
  if (!product.ageGroups.includes(features.ageGroup)) return false;
  if (ageInappropriate(product, features)) return false;
  if (genderMismatch(product, features.gender)) return false;
  if (isAvoidedGiftCategory(product)) return false;
  if (isAmazonSearchUrl(product.buyUrl)) return false;
  const asin = extractAsin(product.buyUrl);
  return !!asin && isAmazonPdpUrl(product.buyUrl);
}

/** Emergency fillers: same PDP rule — no search pages. */
export function catalogEmergencyEligible(product: Product, features: ProfileFeatures): boolean {
  return catalogEligible(product, features);
}

/** Build a shortlist of /dp/ASIN gifts only (probe happens in validateRecommendations). */
export function emergencyGiftList(
  scored: { product: Product; score: number; reasons: string[] }[],
  features: ProfileFeatures,
  limit: number,
): Recommendation[] {
  const pool = scored.filter((s) => catalogEmergencyEligible(s.product, features));
  const picked = pool.slice(0, Math.max(4, limit));

  return picked.map((s, i) => {
    const asin = extractAsin(s.product.buyUrl)!;
    const product: Product = {
      ...s.product,
      buyUrl: amazonAsinUrl(asin),
      imageUrl: amazonAsinImageUrl(asin, 300),
      provider: "amazon",
    };
    return {
      slot: (["The One", "The Wow", "The Smart Pick", "The Wildcard"] as const)[i % 4]!,
      rank: i + 1,
      product,
      score: Number(s.score.toFixed(4)),
      reason: s.reasons.length
        ? s.reasons.slice(0, 2).join(" and ")
        : "lines up with their answers and budget",
    };
  });
}

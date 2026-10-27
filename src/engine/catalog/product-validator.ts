import { amazonAsinUrl } from "../affiliates/amazon";
import { matchesAvoidCategory } from "../config";
import { genderMismatch } from "../features/fit";
import type { ProfileFeatures } from "../features/profile";
import type { Product, Recommendation } from "../types";
import { engineLog, engineWarn } from "../utils/logger";
import { isPlaceholderAmazonTitle, resolveAsinTitles } from "./asin-title.server";
import { amazonAsinImageUrl, extractAsin } from "./product-images";
import { applyLiveHit, resolveToLiveProduct } from "./resolve-live.server";

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

function normalizeAliveAsin(p: Product, asin: string, resolvedTitle?: string | null): Product {
  const title =
    resolvedTitle && resolvedTitle.length >= 6
      ? resolvedTitle.slice(0, 140)
      : p.title;
  return {
    ...p,
    title,
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
 * - physical / gift cards: prefer live amazon.com/dp/ASIN
 * - search-URL / missing / dead ASINs are RE-RESOLVED via curated JSON + Amazon crawl
 *   instead of being dropped (that was wiping the most relevant curated gifts)
 */
export async function validateRecommendations(
  items: Recommendation[],
  opts: ValidateOptions,
): Promise<Recommendation[]> {
  const requireAsin = opts.requireAsinForShopGoods !== false;
  const out: Recommendation[] = [];
  const seenAsin = new Set<string>();
  const seenTitle = new Set<string>();

  type SoftOk = {
    item: Recommendation;
    asin: string | null;
    shopGood: boolean;
    /** Needs title→ASIN resolve (search URL, empty buy link, or missing ASIN). */
    needsResolve: boolean;
  };
  const softOk: SoftOk[] = [];

  for (const item of items) {
    const p = item.product;
    const titleKey = p.title.trim().toLowerCase();
    if (!titleKey || seenTitle.has(titleKey)) continue;
    if (!priceInBudget(p.price, opts.features.budget)) continue;
    if (p.ageGroups.length && !p.ageGroups.includes(opts.features.ageGroup)) continue;
    if (ageInappropriate(p, opts.features)) continue;
    if (genderMismatch(p, opts.features.gender, opts.features.ageGroup)) {
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

    const shopGood = p.giftType === "physical" || p.giftType === "giftcard";
    const asin = extractAsin(p.buyUrl) || extractAsin(p.imageUrl || "");
    const searchUrl = !p.buyUrl || isAmazonSearchUrl(p.buyUrl);
    const nonPdpAmazon = Boolean(p.buyUrl) && isAmazonUrlish(p.buyUrl) && !isAmazonPdpUrl(p.buyUrl) && !isAmazonSearchUrl(p.buyUrl);

    // Search URLs / empty links → queue resolve (do NOT drop relevant curated gifts).
    if (searchUrl || (shopGood && requireAsin && (!asin || !isValidAsinFormat(asin)))) {
      seenTitle.add(titleKey);
      softOk.push({ item, asin: null, shopGood: true, needsResolve: true });
      continue;
    }

    if (nonPdpAmazon && !asin) {
      seenTitle.add(titleKey);
      softOk.push({ item, asin: null, shopGood: true, needsResolve: true });
      continue;
    }

    if (shopGood && requireAsin && asin && isValidAsinFormat(asin)) {
      if (seenAsin.has(asin)) continue;
      seenAsin.add(asin);
      seenTitle.add(titleKey);
      softOk.push({ item, asin, shopGood: true, needsResolve: false });
      continue;
    }

    if (!p.buyUrl.startsWith("http")) {
      seenTitle.add(titleKey);
      softOk.push({ item, asin: null, shopGood: true, needsResolve: true });
      continue;
    }

    if (isAmazonPdpUrl(p.buyUrl) && asin) {
      if (seenAsin.has(asin)) continue;
      seenAsin.add(asin);
      seenTitle.add(titleKey);
      softOk.push({ item, asin, shopGood: false, needsResolve: false });
      continue;
    }

    seenTitle.add(titleKey);
    softOk.push({
      item,
      asin: asin && isValidAsinFormat(asin) ? asin : null,
      shopGood: false,
      needsResolve: !asin,
    });
  }

  // Resolve search-URL / missing-ASIN gifts via curated JSON + Amazon crawl (capped).
  const toResolve = softOk.filter((s) => s.needsResolve).slice(0, 12);
  if (toResolve.length) {
    engineLog(`engine: resolving ${toResolve.length} gifts without live /dp (curated JSON + Amazon search)`);
  }
  await mapPool(toResolve, 4, async (row) => {
    const hit = await resolveToLiveProduct(row.item.product, opts.features.ageGroup);
    if (!hit) {
      engineWarn("engine: could not resolve live ASIN for", row.item.product.title);
      return;
    }
    if (seenAsin.has(hit.asin)) {
      engineWarn("engine: resolved ASIN already used", hit.asin, row.item.product.title);
      return;
    }
    seenAsin.add(hit.asin);
    row.asin = hit.asin;
    row.needsResolve = false;
    row.item = {
      ...row.item,
      product: applyLiveHit(row.item.product, hit),
    };
    engineLog(
      `engine: resolved “${row.item.product.title.slice(0, 42)}” → ${hit.asin} (${hit.source})`,
    );
  });

  const afterResolve = softOk.filter((s) => !(s.needsResolve && requireAsin && s.shopGood));

  const toProbe = afterResolve.map((s) => s.asin).filter((a): a is string => !!a);
  const statuses = await probeAsinsParallel(toProbe, 8);

  // Dead ASINs → try re-resolve by title before dropping.
  const deadRows = afterResolve.filter(
    (s) => s.asin && (statuses.get(s.asin) ?? "unknown") === "dead",
  );
  if (deadRows.length) {
    engineLog(`engine: re-resolving ${deadRows.length} dead ASIN(s) via title search`);
  }
  await mapPool(deadRows.slice(0, 8), 3, async (row) => {
    const oldAsin = row.asin!;
    const hit = await resolveToLiveProduct(row.item.product, opts.features.ageGroup);
    if (!hit || hit.asin === oldAsin) {
      engineWarn(`engine: dead ASIN could not be replaced`, oldAsin, row.item.product.title);
      row.asin = null;
      return;
    }
    if (seenAsin.has(hit.asin) && hit.asin !== oldAsin) {
      row.asin = null;
      return;
    }
    seenAsin.delete(oldAsin);
    seenAsin.add(hit.asin);
    statuses.set(hit.asin, "alive");
    row.asin = hit.asin;
    row.item = { ...row.item, product: applyLiveHit(row.item.product, hit) };
    engineLog(`engine: replaced dead ${oldAsin} → ${hit.asin} (${hit.source})`);
  });

  const needTitle = afterResolve
    .filter((s) => s.asin && isPlaceholderAmazonTitle(s.item.product.title, s.asin))
    .map((s) => s.asin!)
    .filter((a) => (statuses.get(a) ?? "unknown") !== "dead");
  const resolvedTitles = needTitle.length ? await resolveAsinTitles(needTitle, 4) : new Map<string, string>();
  if (resolvedTitles.size) {
    engineLog(`engine: filled ${resolvedTitles.size} product titles from Amazon PDP`);
  }

  for (const row of afterResolve) {
    const p = row.item.product;
    if (row.asin && (row.shopGood || isAmazonPdpUrl(p.buyUrl))) {
      const status = statuses.get(row.asin) ?? "unknown";
      if (status === "dead" || !row.asin) {
        engineWarn(`engine: skipping unrecovered dead ASIN`, row.asin || "?", p.title);
        continue;
      }
      if (status === "unknown") {
        engineWarn(`engine: soft-keeping unknown ASIN (CDN/bot wall)`, row.asin, p.title);
      }
      const realTitle = resolvedTitles.get(row.asin.toUpperCase()) ?? null;
      out.push({ ...row.item, product: normalizeAliveAsin(p, row.asin, realTitle) });
      continue;
    }

    if (requireAsin && row.shopGood && !row.asin) continue;

    const realTitle = row.asin ? resolvedTitles.get(row.asin.toUpperCase()) : null;
    out.push({
      ...row.item,
      product: {
        ...p,
        ...(realTitle ? { title: realTitle.slice(0, 140) } : {}),
        imageUrl: row.asin ? amazonAsinImageUrl(row.asin, 300) : p.imageUrl,
      },
    });
  }

  return out;
}

/** Limited-concurrency async map. */
async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()),
  );
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
  if (genderMismatch(product, features.gender, features.ageGroup)) return false;
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

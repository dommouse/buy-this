import { budgetToTier } from "../features/profile";
import type { ProfileFeatures } from "../features/profile";
import { titleHitsBlocklist } from "../keywords/blocklist";
import type { Product, RecipientProfile } from "../types";
import { extractAsin } from "../catalog/product-images";

export type FilterSpec = {
  occasion: string;
  ageRange: string;
  relationship: string;
  budget: string;
  priceMin: number;
  priceMax: number;
  personality: string[];
  interests: string[];
  wearUseDo: string;
  parentType: string;
  helpWith: string;
};

export function buildFilterSpec(profile: RecipientProfile, features: ProfileFeatures): FilterSpec {
  const wall = features.priceWall ?? { min: 0, max: 5000 };
  return {
    occasion: profile.occasion,
    ageRange: features.ageRange,
    relationship: profile.relationship,
    budget: profile.budget,
    priceMin: wall.min,
    priceMax: wall.max,
    personality: features.personality,
    interests: profile.interests,
    wearUseDo: features.wearUseDo,
    parentType: profile.parentType || "",
    helpWith: profile.helpWith || "",
  };
}

function overlaps(hay: string[] | undefined, needles: string[]): boolean {
  if (!needles.length) return true;
  if (!hay?.length) return true; // untagged = soft pass until batches import
  const lower = hay.map((h) => h.toLowerCase());
  return needles.some((n) => lower.some((h) => h.includes(n.toLowerCase()) || n.toLowerCase().includes(h)));
}

/** How well a catalog row matches questionnaire answers (higher = better). */
export function catalogAnswerScore(
  p: Product,
  spec: FilterSpec,
  features: ProfileFeatures,
): number {
  let score = 0;
  const blob = `${p.title} ${p.description} ${p.category} ${p.tags.join(" ")} ${(p.parentTypes || []).join(" ")} ${(p.occasions || []).join(" ")}`.toLowerCase();

  if (spec.occasion && overlaps(p.occasions, [spec.occasion])) score += 4;
  else if (spec.occasion && p.occasions?.length) score -= 1; // tagged for other occasions

  if (spec.relationship && overlaps(p.relationships, [spec.relationship, "Friend", "Family"])) {
    score += 2;
  }
  if (spec.relationship === "Grandparent" && /grandparent|grandma|grandpa|grand/i.test(blob)) {
    score += 3;
  }

  for (const pers of spec.personality) {
    const pl = pers.toLowerCase();
    if (overlaps(p.parentTypes, [pers]) || overlaps(p.tags, [pers]) || blob.includes(pl)) score += 3;
  }
  if (spec.parentType && (overlaps(p.parentTypes, [spec.parentType]) || blob.includes(spec.parentType.toLowerCase()))) {
    score += 3;
  }
  if (spec.helpWith && (overlaps(p.tags, [spec.helpWith]) || blob.includes(spec.helpWith.toLowerCase()))) {
    score += 4;
  }
  for (const interest of spec.interests) {
    const words = interest
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    if (words.some((w) => blob.includes(w))) score += 2;
  }
  if (spec.wearUseDo && p.wearUseDo && p.wearUseDo === spec.wearUseDo) score += 2;

  const tier = budgetToTier(spec.budget);
  if (tier && p.priceTier === tier) score += 1;

  if (features.gender === "woman" && (p.audience === "women" || /\bwomen|girls|beauty|skincare\b/i.test(blob))) {
    score += 1.5;
  }
  if (features.gender === "man" && (p.audience === "men" || /\bmen|boys|grooming\b/i.test(blob))) {
    score += 1.5;
  }
  // Penalize girly/beauty catalog hits for boys
  if (features.gender === "man" && /\b(girly|princess|nail polish|makeup|lipstick|mascara)\b/i.test(blob)) {
    score -= 5;
  }

  return score;
}

/**
 * Hard filters that must never drop: budget wall, age rules, blacklist.
 * Occasion / personality are SOFT (scored) so different answers yield different pools —
 * hard occasion drops were making every path fall back to the same thin set.
 */
export function filterCatalogPool(
  products: Product[],
  spec: FilterSpec,
  profile: RecipientProfile,
  features: ProfileFeatures,
  opts?: { dropWear?: boolean; dropInterests?: boolean; dropPersonality?: boolean; requireOccasion?: boolean },
): Product[] {
  const tier = budgetToTier(spec.budget);

  let pool = products.filter((p) => {
    // Budget hard wall
    if (p.price < spec.priceMin || p.price > spec.priceMax) return false;
    if (titleHitsBlocklist(p.title, profile, features)) return false;

    // Age group hard
    if (p.ageGroups.length) {
      const ageOk =
        p.ageGroups.includes(features.ageGroup) ||
        (features.ageGroup === "teen" && p.ageGroups.includes("adult")) ||
        (features.ageGroup === "adult" && p.ageGroups.includes("teen")) ||
        (/baby shower/i.test(spec.occasion) &&
          (p.ageGroups.includes("child") || p.ageGroups.includes("adult") || p.category.toLowerCase() === "baby"));
      if (!ageOk) return false;
    }

    // Optional hard occasion (only when pool is rich)
    if (opts?.requireOccasion && spec.occasion && p.occasions?.length) {
      if (!overlaps(p.occasions, [spec.occasion])) return false;
    }

    // Coworker relationship still stricter
    if (p.relationships?.length && /coworker|boss/i.test(spec.relationship)) {
      if (!overlaps(p.relationships, ["Coworker or Boss", "Coworker", "Friend"])) return false;
    }

    // Price tier: allow adjacent
    if (tier && p.priceTier && p.priceTier !== tier) {
      const order = ["$", "$$", "$$$", "$$$$"];
      const a = order.indexOf(tier);
      const b = order.indexOf(p.priceTier);
      if (a >= 0 && b >= 0 && Math.abs(a - b) > 1) return false;
    }

    return true;
  });

  // Rank by answer fit so soft layers keep the best matches first
  pool = [...pool].sort(
    (a, b) => catalogAnswerScore(b, spec, features) - catalogAnswerScore(a, spec, features),
  );

  if (!opts?.dropWear && spec.wearUseDo) {
    const narrowed = pool.filter((p) => !p.wearUseDo || p.wearUseDo === spec.wearUseDo);
    if (narrowed.length >= 4) pool = narrowed;
  }

  if (!opts?.dropInterests && spec.interests.length) {
    const narrowed = pool.filter((p) => {
      const blob = `${p.title} ${p.category} ${p.tags.join(" ")}`.toLowerCase();
      return spec.interests.some((i) =>
        i
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length > 2)
          .some((w) => blob.includes(w)),
      );
    });
    if (narrowed.length >= 4) pool = narrowed;
  }

  if (!opts?.dropPersonality && (spec.personality.length || spec.parentType || spec.helpWith)) {
    const needles = [...spec.personality, spec.parentType, spec.helpWith].filter(Boolean);
    const narrowed = pool.filter(
      (p) => overlaps(p.parentTypes, needles) || overlaps(p.tags, needles) || catalogAnswerScore(p, spec, features) >= 3,
    );
    if (narrowed.length >= 4) pool = narrowed;
  }

  return pool;
}

/** Soften filters from the bottom up when fewer than `min` matches. */
export function filterWithFallback(
  products: Product[],
  spec: FilterSpec,
  profile: RecipientProfile,
  features: ProfileFeatures,
  min = 15,
): Product[] {
  const attempts = [
    { requireOccasion: true },
    {},
    { dropWear: true },
    { dropWear: true, dropInterests: true },
    { dropWear: true, dropInterests: true, dropPersonality: true },
  ] as const;

  for (const opts of attempts) {
    const pool = filterCatalogPool(products, spec, profile, features, opts);
    if (pool.length >= min) return pool;
    if (opts === attempts[attempts.length - 1]) return pool;
  }
  return products
    .filter((p) => p.price >= spec.priceMin && p.price <= spec.priceMax)
    .sort((a, b) => catalogAnswerScore(b, spec, features) - catalogAnswerScore(a, spec, features));
}

export function hardFilterCandidates(
  products: Product[],
  spec: FilterSpec,
  profile: RecipientProfile,
  features: ProfileFeatures,
  usedAsins: Set<string>,
): Product[] {
  const softMin = spec.priceMin > 0 ? spec.priceMin * 0.7 : 0;
  return products
    .filter((p) => {
      if (p.price < softMin || p.price > spec.priceMax) return false;
      if (titleHitsBlocklist(p.title, profile, features)) return false;
      const asin = extractAsin(p.buyUrl)?.toUpperCase() || p.id.toUpperCase();
      if (usedAsins.has(asin)) return false;
      return true;
    })
    .sort((a, b) => catalogAnswerScore(b, spec, features) - catalogAnswerScore(a, spec, features));
}

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

/**
 * Hard filters that must never drop: budget wall, age rules, relationship rules, blacklist.
 * Soft layers (wear → interests → personality) can be relaxed when pool is thin.
 */
export function filterCatalogPool(
  products: Product[],
  spec: FilterSpec,
  profile: RecipientProfile,
  features: ProfileFeatures,
  opts?: { dropWear?: boolean; dropInterests?: boolean; dropPersonality?: boolean },
): Product[] {
  const tier = budgetToTier(spec.budget);
  const ageTag = spec.ageRange ? `Age ${spec.ageRange}` : "";

  let pool = products.filter((p) => {
    // Budget hard wall 75–100%
    if (p.price < spec.priceMin || p.price > spec.priceMax) return false;
    if (titleHitsBlocklist(p.title, profile, features)) return false;

    // Age group hard (Baby Shower uses child; also allow adult postpartum items tagged adult)
    if (p.ageGroups.length) {
      const ageOk =
        p.ageGroups.includes(features.ageGroup) ||
        (features.ageGroup === "teen" && p.ageGroups.includes("adult")) ||
        (/baby shower/i.test(spec.occasion) &&
          (p.ageGroups.includes("child") || p.ageGroups.includes("adult") || p.category.toLowerCase() === "baby"));
      if (!ageOk) return false;
    }

    // Occasion soft-tagged
    if (p.occasions?.length) {
      const okOcc =
        overlaps(p.occasions, [spec.occasion]) ||
        (ageTag ? overlaps(p.occasions, [ageTag, spec.ageRange]) : false);
      if (!okOcc && spec.occasion) return false;
    }

    // Relationship soft-tagged
    if (p.relationships?.length && spec.relationship) {
      if (!overlaps(p.relationships, [spec.relationship, "Friend", "Family"])) {
        // Coworker strict
        if (/coworker|boss/i.test(spec.relationship) && !overlaps(p.relationships, ["Coworker or Boss", "Coworker"])) {
          return false;
        }
      }
    }

    // Price tier soft match when present
    if (tier && p.priceTier && p.priceTier !== tier) {
      // allow adjacent tier one step
      const order = ["$", "$$", "$$$", "$$$$"];
      const a = order.indexOf(tier);
      const b = order.indexOf(p.priceTier);
      if (a >= 0 && b >= 0 && Math.abs(a - b) > 1) return false;
    }

    return true;
  });

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

  if (!opts?.dropPersonality && (spec.personality.length || spec.parentType)) {
    const needles = [...spec.personality, spec.parentType].filter(Boolean);
    const narrowed = pool.filter((p) => overlaps(p.parentTypes, needles) || overlaps(p.tags, needles));
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
  return products.filter((p) => p.price >= spec.priceMin && p.price <= spec.priceMax);
}

export function hardFilterCandidates(
  products: Product[],
  spec: FilterSpec,
  profile: RecipientProfile,
  features: ProfileFeatures,
  usedAsins: Set<string>,
): Product[] {
  // Soft floor (~70% of wall min) so relevant curated gifts just under the
  // 75% wall still enter the pool and can be live-resolved.
  const softMin = spec.priceMin > 0 ? spec.priceMin * 0.7 : 0;
  return products.filter((p) => {
    if (p.price < softMin || p.price > spec.priceMax) return false;
    if (titleHitsBlocklist(p.title, profile, features)) return false;
    const asin = extractAsin(p.buyUrl)?.toUpperCase() || p.id.toUpperCase();
    if (usedAsins.has(asin)) return false;
    return true;
  });
}

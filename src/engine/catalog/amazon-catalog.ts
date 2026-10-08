import { amazonAsinUrl } from "../affiliates/amazon";
import { amazonAsinImageUrl } from "./product-images";
import type { Product } from "../types";

/**
 * Curated Amazon gift catalog — ASIN /dp/ links ONLY (no /s? search pages).
 * ASINs below were probe-verified as live product detail pages.
 * Used when Claude is unavailable or to top up a shortlist.
 */

type Row = [
  id: string,
  title: string,
  description: string,
  category: string,
  price: number,
  tags: string[],
  ages: Product["ageGroups"],
  giftType: Product["giftType"],
  asin: string,
];

const rows: Row[] = [
  ["amz-kindle-paperwhite", "Kindle Paperwhite", "Glare-free e-reader with weeks of battery — perfect for book lovers.", "Books", 139, ["Reading", "Travel", "Homebody", "Intellectual"], ["adult", "teen"], "physical", "B0CFPJYX7P"],
  ["amz-echo-pop", "Echo Pop Smart Speaker", "Compact Alexa speaker with rich sound for kitchens and desks.", "Tech", 39, ["Tech/Gadgets", "Homebody", "Hustler"], ["adult", "teen"], "physical", "B09B8V1LZ3"],
  ["amz-fire-tv-stick", "Fire TV Stick 4K", "Stream movies and shows in 4K with Alexa voice remote.", "Tech", 49, ["Movies/TV", "Tech/Gadgets", "Homebody"], ["adult", "teen"], "physical", "B0BP9SNVH9"],
  ["amz-instant-pot", "Instant Pot Duo", "7-in-1 pressure cooker for busy home cooks.", "Kitchen", 99, ["Cooking/Food", "Homebody", "Hustler", "Housewarming"], ["adult"], "physical", "B00FLYWNYQ"],
  ["amz-revlon-brush", "Revlon One-Step Hair Dryer Brush", "Blow-dry and volumize in one step — a salon-style everyday tool.", "Beauty", 45, ["Fashion/Beauty", "Trendsetter", "Mom"], ["adult", "teen"], "physical", "B01LSUQSB0"],
  ["amz-ninja-blender", "Ninja Personal Blender", "Smoothies and shakes on the go — dishwasher-safe cups.", "Kitchen", 59, ["Cooking/Food", "Sports/Fitness", "Wellness-focused"], ["adult", "teen"], "physical", "B07QZ3CZ48"],
  ["amz-airpods", "Apple AirPods", "Wireless earbuds with seamless pairing and clear call quality.", "Tech", 129, ["Music", "Tech/Gadgets", "Travel", "Hustler"], ["adult", "teen"], "physical", "B09V3KXJPB"],
  ["amz-airpods-pro", "Apple AirPods (USB-C)", "Everyday wireless earbuds with a modern charging case.", "Tech", 129, ["Music", "Tech/Gadgets", "Travel"], ["adult", "teen"], "physical", "B0CHWRXH8B"],
  ["amz-silk-pillowcase", "Mulberry Silk Pillowcase", "Softer on hair and skin — a small luxury upgrade.", "Beauty", 29, ["Fashion/Beauty", "Wellness-focused", "Homebody"], ["adult", "teen"], "physical", "B07ZPML7NP"],
  ["amz-resistance-bands", "Resistance Band Set", "Full-body strength kit that packs small for home or travel.", "Wellness", 24, ["Sports/Fitness", "Wellness-focused", "Hustler"], ["adult", "teen"], "physical", "B01AVDVHTI"],
  ["amz-headphones-nc", "Noise Cancelling Headphones", "Quiet the commute with deep noise cancellation.", "Tech", 149, ["Music", "Tech/Gadgets", "Travel", "Hustler"], ["adult", "teen"], "physical", "B07PXGQC1Q"],
  ["amz-alchemist", "The Alchemist by Paulo Coelho", "Beloved novel about following your personal legend — a timeless gift.", "Books", 12, ["Reading", "Intellectual", "Spirituality/Faith", "Travel"], ["adult", "teen"], "physical", "0062315005"],
  ["amz-yeti-tumbler", "YETI Rambler Tumbler", "Insulated drinkware that keeps coffee hot and water cold.", "Outdoors", 35, ["Outdoorsy", "Sports/Fitness", "Travel", "Dad"], ["adult", "teen"], "physical", "B00I15SB16"],
];

export const amazonCatalog: Product[] = rows.map(
  ([id, title, description, category, price, tags, ageGroups, giftType, asin]) => ({
    id,
    title,
    description,
    category,
    price,
    currency: "USD",
    tags,
    ageGroups,
    giftType,
    imageUrl: amazonAsinImageUrl(asin),
    buyUrl: amazonAsinUrl(asin),
    provider: "amazon",
    popularity: 2,
  }),
);

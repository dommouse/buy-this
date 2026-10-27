import { amazonAsinUrl } from "../affiliates/amazon";
import { amazonAsinImageUrl } from "./product-images";
import type { PriceTier, Product, WearUseDo } from "../types";

/**
 * Curated Amazon gift catalog — ASIN /dp/ links ONLY.
 * Tags include Dominique columns so CuratedAdapter can filter before Amazon fill.
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
  occasions: string[],
  priceTier: PriceTier,
  relationships: string[],
  parentTypes: string[],
  wearUseDo: WearUseDo,
];

const rows: Row[] = [
  // Baby Shower (under $25) — Path A curated fill when Amazon HTML is thin
  ["amz-swaddle-sack", "Halo SleepSack Swaddle", "Safer sleep sack (not a loose blanket) for newborns.", "Baby", 22, ["Sleep", "Safe Sleep", "audience:kids"], ["child"], "physical", "B00TRLDHBA", ["Baby Shower"], "$", ["Friend", "Family", "Coworker"], ["Safety-First", "Minimalist"], "use"],
  ["amz-baby-tub", "Angelcare Soft Touch Bath Support", "Soft infant bath support for newborn bath time.", "Baby", 20, ["Bath time", "audience:kids"], ["child"], "physical", "B000067PYW", ["Baby Shower"], "$", ["Friend", "Family"], ["Safety-First"], "use"],
  ["amz-sound-machine", "Hatch Rest Mini Sound Machine", "Nursery sound machine for better sleep.", "Baby", 25, ["Nursery", "Sleep", "Tech-savvy"], ["child", "adult"], "physical", "B08CJ5K86H", ["Baby Shower", "Birthday"], "$", ["Friend", "Family", "Partner"], ["Tech-Savvy", "Safety-First"], "use"],
  ["amz-diaper-caddy", "Diaper Caddy Organizer", "Portable nursery organizer for diapers and wipes.", "Baby", 18, ["Nursery", "On The Go"], ["child", "adult"], "physical", "B07D3FZX8K", ["Baby Shower"], "$", ["Friend", "Family", "Coworker"], ["On The Go", "Minimalist"], "use"],
  ["amz-play-gym", "Baby Play Gym Mat", "Tummy-time play gym with soft hanging toys.", "Baby", 24, ["Play", "Sensory play", "audience:kids"], ["child"], "physical", "B07PP54QBQ", ["Baby Shower", "Birthday", "Age 1-3"], "$", ["Friend", "Family", "Child"], ["Creative", "Active"], "use"],
  ["amz-frida-mom", "Frida Mom Postpartum Recovery Kit", "Postpartum essentials for new mom care.", "Baby", 25, ["Postpartum", "Postpartum and mom care"], ["adult"], "physical", "B07PP5ZQ8Y", ["Baby Shower"], "$", ["Friend", "Family"], ["Creative/Keepsake", "Safety-First"], "use"],
  ["amz-hotwheels-20", "Hot Wheels 20-Car Pack", "Die-cast cars for racing and collecting.", "Toys", 20, ["Vehicles", "Sports", "audience:kids", "for boys"], ["child"], "physical", "B00IT13H9S", ["Birthday", "Christmas", "Age 1-3", "Age 4-9"], "$", ["Child", "Friend"], ["Active"], "use"],
  ["amz-playdoh-case", "Play-Doh Modeling Compound Case", "Colorful dough for creative play.", "Toys", 18, ["Art and crafts", "Sensory play", "audience:kids"], ["child"], "physical", "B009AQ3F3M", ["Birthday", "Christmas", "Age 1-3", "Age 4-9"], "$", ["Child"], ["Creative"], "use"],
  ["amz-kinetic-sand", "Kinetic Sand Play Set", "Mess-free moldable sand.", "Toys", 16, ["Sensory play", "audience:kids"], ["child"], "physical", "B00KAL5KQ0", ["Birthday", "Age 1-3", "Age 4-9"], "$", ["Child"], ["Creative"], "use"],
  ["amz-crayola-kit", "Crayola Inspiration Art Case", "Crayons, markers and paper.", "Toys", 22, ["Art and crafts", "audience:kids"], ["child", "teen"], "physical", "B01C4MSKGS", ["Birthday", "Christmas", "Age 4-9"], "$", ["Child"], ["Creative"], "use"],
  ["amz-duplo-box", "LEGO DUPLO Classic Brick Box", "Chunky bricks for little hands.", "Toys", 24, ["Building and LEGO", "audience:kids"], ["child"], "physical", "B00NHQFZ1A", ["Birthday", "Age 1-3"], "$", ["Child"], ["Creative"], "use"],
  ["amz-unicorn-plush", "Soft Unicorn Plush Toy", "Huggable plush for bedtime.", "Toys", 15, ["Animals", "audience:kids", "for girls"], ["child"], "physical", "B07D3F7QXP", ["Birthday", "Age 1-3", "Age 4-9"], "$", ["Child"], ["Sentimental"], "use"],
  ["amz-kindle-paperwhite", "Kindle Paperwhite", "Glare-free e-reader.", "Books", 139, ["Reading", "Loves to read", "Travel"], ["adult", "teen"], "physical", "B0CFPJYX7P", ["Birthday", "Christmas", "Graduation"], "$$$", ["Partner", "Friend", "Parent", "Other family member"], ["Loves to read", "Minimalist"], "use"],
  ["amz-echo-pop", "Echo Pop Smart Speaker", "Compact Alexa speaker.", "Tech", 39, ["Tech", "Tech-savvy", "Music"], ["adult", "teen"], "physical", "B09B8V1LZ3", ["Birthday", "Christmas", "Housewarming"], "$$", ["Friend", "Partner", "Coworker or Boss", "Parent"], ["Tech-savvy"], "use"],
  ["amz-fire-tv-stick", "Fire TV Stick 4K", "Stream in 4K with Alexa remote.", "Tech", 49, ["Tech", "Movies/TV"], ["adult", "teen"], "physical", "B0BP9SNVH9", ["Birthday", "Christmas", "Housewarming"], "$$", ["Friend", "Partner", "Parent"], ["Tech-savvy", "Active"], "use"],
  ["amz-revlon-brush", "Revlon One-Step Hair Dryer Brush", "Blow-dry and volumize in one step.", "Beauty", 45, ["Beauty and hair", "Fashion", "Trendy and fashion-forward"], ["adult", "teen"], "physical", "B01LSUQSB0", ["Birthday", "Christmas", "Mother's Day"], "$$", ["Partner", "Friend", "Parent", "Child"], ["Trendy and fashion-forward"], "use"],
  ["amz-airpods", "Apple AirPods", "Wireless earbuds with clear calls.", "Tech", 129, ["Music", "Tech", "Travel"], ["adult", "teen"], "physical", "B09V3KXJPB", ["Birthday", "Christmas", "Graduation", "Valentine's Day"], "$$$", ["Partner", "Friend", "Child", "Parent"], ["Tech-savvy", "Trendy and fashion-forward"], "use"],
  ["amz-airpods-pro", "Apple AirPods (USB-C)", "Everyday wireless earbuds.", "Tech", 129, ["Music", "Tech", "Travel"], ["adult", "teen"], "physical", "B0CHWRXH8B", ["Birthday", "Christmas", "Anniversary"], "$$$", ["Partner", "Friend", "Parent"], ["Tech-savvy"], "use"],
  ["amz-silk-pillowcase", "Mulberry Silk Pillowcase", "Softer on hair and skin.", "Beauty", 29, ["Beauty and hair", "Wellness", "Wellness-focused", "Homebody"], ["adult", "teen"], "physical", "B07ZPML7NP", ["Birthday", "Mother's Day", "Christmas"], "$$", ["Partner", "Parent", "Friend"], ["Minimalist", "Trendy and fashion-forward", "Wellness-focused", "Homebody"], "use"],
  ["amz-resistance-bands", "Resistance Band Set", "Full-body strength kit.", "Wellness", 24, ["Sports", "Active", "Sports/Fitness"], ["adult", "teen"], "physical", "B01AVDVHTI", ["Birthday", "Christmas"], "$", ["Friend", "Sibling", "Other family member"], ["Active"], "use"],
  ["amz-headphones-nc", "Noise Cancelling Headphones", "Deep noise cancellation.", "Tech", 149, ["Music", "Tech", "Travel"], ["adult", "teen"], "physical", "B07PXGQC1Q", ["Birthday", "Christmas", "Graduation"], "$$$", ["Partner", "Friend", "Parent", "Child"], ["Tech-savvy"], "use"],
  ["amz-alchemist", "The Alchemist by Paulo Coelho", "Beloved novel about following your legend.", "Books", 12, ["Reading", "Loves to read"], ["adult", "teen"], "physical", "0062315005", ["Birthday", "Graduation", "Christmas"], "$", ["Friend", "Partner", "Parent", "Coworker or Boss"], ["Loves to read", "Sentimental"], "use"],
  ["amz-yeti-tumbler", "YETI Rambler Tumbler", "Insulated drinkware.", "Outdoors", 35, ["Outdoors", "Sports", "Travel", "Coffee person"], ["adult", "teen"], "physical", "B00I15SB16", ["Birthday", "Father's Day", "Christmas"], "$$", ["Friend", "Parent", "Partner", "Coworker or Boss"], ["Active", "Minimalist"], "use"],
  ["amz-cocktail-set", "Cocktail Shaker Bar Set", "Fun entertaining bar tools.", "Home", 42, ["Drink and bar items", "Fun entertaining gadgets", "Wine/Cocktails"], ["adult"], "physical", "B07DZW8Y91", ["Housewarming", "Birthday", "Christmas"], "$$", ["Friend", "Partner", "Other family member"], ["Active"], "use"],
  ["amz-popcorn-maker", "Home Popcorn Maker", "Entertaining snack gadget.", "Home", 38, ["Fun entertaining gadgets", "Games"], ["adult"], "physical", "B07G763L6Y", ["Housewarming", "Christmas"], "$$", ["Friend", "Partner", "Other family member"], [], "use"],
  ["amz-passport-holder", "Leather Passport Holder", "Travel document organizer.", "Fashion", 28, ["Travel", "Fashion"], ["adult", "teen"], "physical", "B07QXZQY8K", ["Birthday", "Graduation", "Christmas", "Anniversary"], "$$", ["Partner", "Friend", "Parent"], ["Trendy and fashion-forward", "Minimalist"], "use"],
];

export const amazonCatalog: Product[] = rows.map(
  ([
    id,
    title,
    description,
    category,
    price,
    tags,
    ageGroups,
    giftType,
    asin,
    occasions,
    priceTier,
    relationships,
    parentTypes,
    wearUseDo,
  ]) => ({
    id,
    title,
    description,
    category,
    price,
    currency: "USD",
    tags,
    ageGroups,
    giftType,
    audience: ageGroups.includes("child")
      ? ("kids" as const)
      : tags.some((t) => /for girls|women/i.test(t))
        ? ("women" as const)
        : tags.some((t) => /for boys|for men|\bDad\b/i.test(t))
          ? ("men" as const)
          : ("unisex" as const),
    imageUrl: amazonAsinImageUrl(asin),
    buyUrl: amazonAsinUrl(asin),
    provider: "amazon",
    popularity: 2,
    occasions,
    priceTier,
    relationships,
    parentTypes,
    wearUseDo,
  }),
);

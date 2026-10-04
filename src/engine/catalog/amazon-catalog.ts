import { amazonAsinUrl, amazonSearchUrl } from "../affiliates/amazon";
import { amazonAsinImageUrl } from "./product-images";
import type { Product } from "../types";

/**
 * Curated Amazon-oriented gift catalog used when:
 * - Claude is unavailable (fallback scoring)
 * - ENGINE_MODE=catalog-hybrid
 * - Product Advertising API keys are not configured yet
 *
 * Links use the Associates store ID via amazonSearchUrl / amazonAsinUrl.
 * Prefer real ASINs when known; otherwise Amazon search stays shoppable + tagged.
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
  asinOrQuery: string,
  kind: "asin" | "search",
];

const rows: Row[] = [
  ["amz-kindle-paperwhite", "Kindle Paperwhite", "Glare-free e-reader with weeks of battery — perfect for book lovers.", "Books", 139, ["Reading", "Travel", "Homebody", "Intellectual"], ["adult", "teen"], "physical", "B0CFPJYX7P", "asin"],
  ["amz-echo-pop", "Echo Pop Smart Speaker", "Compact Alexa speaker with rich sound for kitchens and desks.", "Tech", 39, ["Tech/Gadgets", "Homebody", "Hustler"], ["adult", "teen"], "physical", "B09ZX86WB4", "asin"],
  ["amz-fire-tv-stick", "Fire TV Stick 4K", "Stream movies and shows in 4K with Alexa voice remote.", "Tech", 49, ["Movies/TV", "Tech/Gadgets", "Homebody"], ["adult", "teen"], "physical", "B0BP9SNVH9", "asin"],
  ["amz-instant-pot", "Instant Pot Duo", "7-in-1 pressure cooker for busy home cooks.", "Kitchen", 99, ["Cooking/Food", "Homebody", "Hustler", "Housewarming"], ["adult"], "physical", "B00FLYWNYQ", "asin"],
  ["amz-ninja-blender", "Ninja Personal Blender", "Smoothies and shakes on the go — dishwasher-safe cups.", "Kitchen", 59, ["Cooking/Food", "Sports/Fitness", "Wellness-focused"], ["adult", "teen"], "physical", "Ninja Personal Blender", "search"],
  ["amz-yeti-tumbler", "YETI Rambler Tumbler", "Insulated drinkware that keeps coffee hot and water cold.", "Outdoors", 35, ["Outdoorsy", "Sports/Fitness", "Travel", "Dad"], ["adult", "teen"], "physical", "YETI Rambler Tumbler", "search"],
  ["amz-lego-icons", "LEGO Icons Botanical Set", "Build-and-display flower set for creative desks and shelves.", "Toys", 49, ["DIY/Crafts", "Creative", "Home Decor", "Art/Design"], ["adult", "teen"], "physical", "LEGO Icons Botanical Collection", "search"],
  ["amz-airpods", "Apple AirPods", "Wireless earbuds with seamless pairing and clear call quality.", "Tech", 129, ["Music", "Tech/Gadgets", "Travel", "Hustler"], ["adult", "teen"], "physical", "Apple AirPods", "search"],
  ["amz-massage-gun", "Muscle Massage Gun", "Percussion massager for post-workout recovery.", "Wellness", 79, ["Sports/Fitness", "Wellness-focused", "Get Well"], ["adult"], "physical", "Massage Gun Deep Tissue", "search"],
  ["amz-weighted-blanket", "Weighted Blanket", "Calming pressure blanket for better sleep and cozy nights.", "Home", 69, ["Wellness-focused", "Homebody", "Get Well"], ["adult", "teen"], "physical", "Weighted Blanket Queen", "search"],
  ["amz-silk-pillowcase", "Mulberry Silk Pillowcase", "Softer on hair and skin — a small luxury upgrade.", "Beauty", 29, ["Fashion/Beauty", "Wellness-focused", "Homebody"], ["adult", "teen"], "physical", "Mulberry Silk Pillowcase", "search"],
  ["amz-skincare-set", "Skincare Gift Set", "Cleanser, serum, and moisturizer in a gift-ready set.", "Beauty", 45, ["Fashion/Beauty", "Trendsetter", "Mother's Day", "Mom"], ["adult"], "physical", "Skincare Gift Set Women", "search"],
  ["amz-jewelry-box", "Personalized Jewelry Box", "Elegant keepsake box for necklaces and rings.", "Jewelry", 39, ["Fashion/Beauty", "Partner", "Anniversary", "Valentine's Day"], ["adult", "teen"], "physical", "Personalized Jewelry Box", "search"],
  ["amz-wallet", "RFID Leather Wallet", "Slim bifold with RFID blocking — classic practical gift.", "Accessories", 32, ["Dad", "Father's Day", "Hustler", "Graduation"], ["adult"], "physical", "RFID Blocking Leather Wallet", "search"],
  ["amz-smartwatch", "Fitness Smartwatch", "Tracks steps, heart rate, and sleep with long battery life.", "Tech", 89, ["Sports/Fitness", "Tech/Gadgets", "Wellness-focused"], ["adult", "teen"], "physical", "Fitness Smartwatch", "search"],
  ["amz-camera-instant", "Instant Print Camera", "Snap and print memories on the spot — film-friendly fun.", "Photography", 89, ["Photography", "Social Butterfly", "Creative", "Trendsetter"], ["adult", "teen"], "physical", "Fujifilm Instax Mini Camera", "search"],
  ["amz-photo-album", "Custom Photo Album", "Hardcover album for trips, weddings, and family memories.", "Photography", 28, ["Photography", "Partner", "Grandparent", "Anniversary"], ["adult"], "physical", "Custom Photo Album Hardcover", "search"],
  ["amz-board-game", "Strategy Board Game Night Kit", "A crowd-pleasing modern board game for game night.", "Games", 35, ["Gaming", "Social Butterfly", "Homebody"], ["adult", "teen"], "physical", "Best Strategy Board Games", "search"],
  ["amz-gaming-headset", "Gaming Headset", "Surround sound and comfy mic for long sessions.", "Gaming", 59, ["Gaming", "Tech/Gadgets"], ["adult", "teen"], "physical", "Gaming Headset with Microphone", "search"],
  ["amz-controller", "Wireless Game Controller", "Responsive pads and long battery for console or PC.", "Gaming", 49, ["Gaming", "Tech/Gadgets"], ["adult", "teen"], "physical", "Wireless Game Controller", "search"],
  ["amz-travel-organizer", "Packing Cubes Set", "Compress and organize luggage for stress-free trips.", "Travel", 25, ["Travel", "Outdoorsy", "Hustler"], ["adult"], "physical", "Packing Cubes Set", "search"],
  ["amz-travel-neck-pillow", "Memory Foam Travel Pillow", "Supportive neck pillow for flights and long drives.", "Travel", 22, ["Travel", "Get Well"], ["adult", "teen"], "physical", "Memory Foam Travel Neck Pillow", "search"],
  ["amz-gardening-kit", "Indoor Herb Garden Kit", "Grow basil and mint on a sunny windowsill.", "Garden", 34, ["Gardening", "Cooking/Food", "Homebody", "Housewarming"], ["adult"], "physical", "Indoor Herb Garden Kit", "search"],
  ["amz-candle-set", "Luxury Candle Gift Set", "Layered scents in a giftable box for homebodies.", "Home", 36, ["Home Decor", "Homebody", "Housewarming", "Mom"], ["adult"], "physical", "Luxury Candle Gift Set", "search"],
  ["amz-throw-blanket", "Soft Knit Throw Blanket", "Couch-ready throw for movie nights.", "Home", 39, ["Home Decor", "Homebody", "Housewarming"], ["adult"], "physical", "Chunky Knit Throw Blanket", "search"],
  ["amz-coffee-sampler", "Specialty Coffee Sampler", "Single-origin bags for the daily brew ritual.", "Drinks", 32, ["Cooking/Food", "Hustler", "Coworker/Boss"], ["adult"], "physical", "Specialty Coffee Sampler Gift", "search"],
  ["amz-cocktail-kit", "Craft Cocktail Mixer Set", "Shaker, jigger, and tools for home bartending.", "Drinks", 45, ["Wine/Cocktails", "Social Butterfly", "Housewarming"], ["adult"], "physical", "Cocktail Shaker Set Gift", "search"],
  ["amz-pet-bed", "Orthopedic Pet Bed", "Supportive bed for dogs or cats who love to lounge.", "Pets", 49, ["Pets/Animals", "Homebody"], ["adult"], "physical", "Orthopedic Dog Bed", "search"],
  ["amz-pet-camera", "Pet Treat Camera", "Check in and toss treats from your phone.", "Pets", 99, ["Pets/Animals", "Tech/Gadgets"], ["adult"], "physical", "Pet Camera Treat Dispenser", "search"],
  ["amz-yoga-mat", "Non-Slip Yoga Mat", "Cushioned mat with carry strap for studio or home.", "Wellness", 29, ["Sports/Fitness", "Wellness-focused", "Spirituality/Faith"], ["adult", "teen"], "physical", "Non Slip Yoga Mat Extra Thick", "search"],
  ["amz-resistance-bands", "Resistance Band Set", "Full-body strength kit that packs small.", "Wellness", 24, ["Sports/Fitness", "Wellness-focused", "Hustler"], ["adult", "teen"], "physical", "Resistance Bands Set with Handles", "search"],
  ["amz-drawing-tablet", "Drawing Tablet with Pen", "Pressure-sensitive tablet for digital art beginners.", "Art", 69, ["Art/Design", "Creative", "Tech/Gadgets"], ["adult", "teen"], "physical", "Drawing Tablet with Stylus", "search"],
  ["amz-watercolor", "Watercolor Paint Set", "Vibrant pans, brushes, and paper for creative afternoons.", "Art", 28, ["Art/Design", "Creative", "DIY/Crafts"], ["adult", "teen", "child"], "physical", "Watercolor Paint Set Professional", "search"],
  ["amz-lego-kids", "LEGO Classic Creative Box", "Open-ended bricks for kids who love to build.", "Toys", 39, ["Child", "DIY/Crafts", "Creative", "Gaming"], ["child", "teen"], "physical", "LEGO Classic Creative Brick Box", "search"],
  ["amz-science-kit", "Kids Science Experiment Kit", "Safe experiments that spark curiosity.", "Toys", 32, ["Child", "Intellectual", "DIY/Crafts"], ["child"], "physical", "Kids Science Experiment Kit", "search"],
  ["amz-plush", "Giant Soft Plush Toy", "Huggable plush for birthdays and comfort gifts.", "Toys", 29, ["Child", "Baby Shower", "Pets/Animals"], ["child"], "physical", "Giant Plush Teddy Bear", "search"],
  ["amz-baby-bundle", "Organic Baby Essentials Bundle", "Soft swaddles and must-haves for new parents.", "Baby", 55, ["Baby Shower", "Child"], ["child"], "physical", "Organic Baby Gift Set", "search"],
  ["amz-journal", "Guided Gratitude Journal", "Daily prompts for reflection and calm.", "Wellness", 18, ["Spirituality/Faith", "Wellness-focused", "Thank You"], ["adult", "teen"], "physical", "Guided Gratitude Journal", "search"],
  ["amz-desk-plant", "Low-Maintenance Desk Plant", "A cheerful plant in a simple pot for any workspace.", "Home", 22, ["Gardening", "Coworker/Boss", "Housewarming"], ["adult"], "physical", "Succulent Plant Gift Pot", "search"],
  ["amz-tool-set", "Compact Home Tool Kit", "The practical gift that gets used every month.", "Home", 42, ["Dad", "Father's Day", "Housewarming", "Hustler"], ["adult"], "physical", "Home Tool Kit Gift Set", "search"],
  ["amz-amazon-gc", "Amazon Gift Card", "Let them pick exactly what they want — zero guesswork.", "Gift Cards", 50, ["Coworker/Boss", "Graduation", "Wedding", "Thank You"], ["adult", "teen", "child"], "giftcard", "Amazon Gift Card", "search"],
  ["amz-spa-set", "At-Home Spa Gift Basket", "Bath bombs, lotion, and cozy self-care essentials.", "Beauty", 40, ["Wellness-focused", "Mom", "Mother's Day", "Get Well", "Partner"], ["adult"], "physical", "Spa Gift Basket Women", "search"],
  ["amz-watch", "Minimalist Watch", "Clean dial and leather strap — elevated everyday style.", "Accessories", 75, ["Fashion/Beauty", "Trendsetter", "Graduation", "Anniversary"], ["adult"], "physical", "Minimalist Leather Watch Men Women", "search"],
  ["amz-headphones-nc", "Noise Cancelling Headphones", "Quiet the commute with deep noise cancellation.", "Tech", 149, ["Music", "Tech/Gadgets", "Travel", "Hustler"], ["adult", "teen"], "physical", "Noise Cancelling Headphones", "search"],
  ["amz-projector", "Mini Portable Projector", "Movie night anywhere — backyard or bedroom wall.", "Tech", 99, ["Movies/TV", "Tech/Gadgets", "Social Butterfly"], ["adult", "teen"], "physical", "Mini Portable Projector", "search"],
  ["amz-car-kit", "Car Detailing Kit", "Wash, wax, and microfiber set for auto lovers.", "Auto", 45, ["Cars/Motorsports", "Dad", "Father's Day"], ["adult"], "physical", "Car Detailing Kit Gift", "search"],
  ["amz-wine-set", "Wine Accessory Gift Set", "Aerator, stopper, and pourer for hosts.", "Drinks", 38, ["Wine/Cocktails", "Partner", "Anniversary", "Housewarming"], ["adult"], "physical", "Wine Accessory Gift Set", "search"],
  ["amz-puzzle", "1000-Piece Art Puzzle", "Slow-evening puzzle with a beautiful finished image.", "Games", 20, ["Homebody", "Intellectual", "Art/Design"], ["adult", "teen"], "physical", "1000 Piece Jigsaw Puzzle Adults", "search"],
];

export const amazonCatalog: Product[] = rows.map(
  ([id, title, description, category, price, tags, ageGroups, giftType, asinOrQuery, kind]) => ({
    id,
    title,
    description,
    category,
    price,
    currency: "USD",
    tags,
    ageGroups,
    giftType,
    imageUrl: kind === "asin" ? amazonAsinImageUrl(asinOrQuery) : null,
    buyUrl: kind === "asin" ? amazonAsinUrl(asinOrQuery) : amazonSearchUrl(asinOrQuery || title),
    provider: "amazon",
    popularity: kind === "asin" ? 2 : 1,
  }),
);

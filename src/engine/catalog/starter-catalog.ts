import type { Product } from "../types";

/**
 * Emergency fallback gift list only.
 * Primary recommendations come from Claude (ENGINE_MODE=claude-suggest).
 * Also used to generate seed SQL via `bun run engine:seed-sql` if you ever seed DB products.
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
];

const rows: Row[] = [
  ["chef-knife-set", "Pro Chef Knife Set", "Three razor-sharp Japanese steel knives for the home cook who means business.", "Kitchen", 89, ["Cooking/Food", "Homebody", "Hustler"], ["adult"], "physical"],
  ["cooking-class", "Local Cooking Class for Two", "A hands-on evening class with a local chef — dinner included.", "Experiences", 140, ["Cooking/Food", "Social Butterfly", "Partner", "Anniversary", "Valentine's Day"], ["adult"], "experience"],
  ["hot-sauce-kit", "Make-Your-Own Hot Sauce Kit", "Peppers, bottles and recipes to brew custom hot sauces.", "Kitchen", 35, ["Cooking/Food", "DIY/Crafts", "Creative"], ["adult", "teen"], "physical"],
  ["smart-watch", "Fitness Smartwatch", "Tracks workouts, sleep and heart rate with a week-long battery.", "Tech", 199, ["Sports/Fitness", "Tech/Gadgets", "Wellness-focused", "Hustler"], ["adult", "teen"], "physical"],
  ["yoga-bundle", "Premium Yoga Bundle", "Cork mat, blocks and strap for a calm daily practice.", "Wellness", 75, ["Wellness-focused", "Sports/Fitness", "Spirituality/Faith"], ["adult", "teen"], "physical"],
  ["massage-gun", "Mini Massage Gun", "Pocket-sized percussion massager for sore muscles.", "Wellness", 79, ["Sports/Fitness", "Wellness-focused", "Get Well"], ["adult"], "physical"],
  ["noise-cancel-headphones", "Noise-Cancelling Headphones", "Studio-quality sound and silence on demand.", "Tech", 249, ["Music", "Tech/Gadgets", "Travel", "Hustler"], ["adult", "teen"], "physical"],
  ["vinyl-player", "Retro Vinyl Record Player", "Suitcase turntable with built-in speakers and Bluetooth.", "Music", 89, ["Music", "Homebody", "Trendsetter"], ["adult", "teen"], "physical"],
  ["concert-tickets", "Concert Tickets Gift Card", "Let them pick the show — any artist, any venue.", "Experiences", 150, ["Music", "Social Butterfly"], ["adult", "teen"], "experience"],
  ["gaming-controller", "Pro Wireless Game Controller", "Back paddles, trigger stops and a 40-hour battery.", "Gaming", 69, ["Gaming", "Tech/Gadgets"], ["adult", "teen"], "physical"],
  ["gaming-gift-card", "Game Store Gift Card", "Digital credit for their next favourite game.", "Gift Cards", 50, ["Gaming"], ["adult", "teen", "child"], "giftcard"],
  ["ereader", "Waterproof E-Reader", "Glare-free screen holds thousands of books for the beach or bath.", "Books", 139, ["Reading", "Intellectual", "Travel", "Homebody"], ["adult", "teen"], "physical"],
  ["book-subscription", "Book of the Month Subscription", "Three months of hand-picked hardcovers delivered.", "Books", 60, ["Reading", "Intellectual"], ["adult"], "experience"],
  ["scratch-map", "Scratch-Off World Map", "Framed map to scratch off every country they've visited.", "Travel", 39, ["Travel", "Outdoorsy", "Home Decor"], ["adult", "teen"], "physical"],
  ["travel-backpack", "Carry-On Travel Backpack", "Opens like a suitcase, fits under any airline seat.", "Travel", 129, ["Travel", "Outdoorsy", "Hustler"], ["adult"], "physical"],
  ["skincare-set", "Luxury Skincare Set", "Cleanser, serum and night cream in a gift-ready box.", "Beauty", 95, ["Fashion/Beauty", "Wellness-focused", "Trendsetter", "Mother's Day"], ["adult"], "physical"],
  ["silk-pillowcase", "Mulberry Silk Pillowcase", "Kinder to hair and skin — a little luxury every night.", "Beauty", 45, ["Fashion/Beauty", "Homebody", "Wellness-focused"], ["adult", "teen"], "physical"],
  ["birthstone-necklace", "Personalised Birthstone Necklace", "Dainty gold necklace with their birthstone and initial.", "Jewelry", 65, ["Fashion/Beauty", "Partner", "Mom", "Anniversary", "Valentine's Day", "Mother's Day"], ["adult", "teen"], "physical"],
  ["leather-wallet", "Slim Leather Wallet", "Full-grain leather, RFID-blocking, engraved initials.", "Accessories", 55, ["Hustler", "Dad", "Father's Day", "Graduation"], ["adult"], "physical"],
  ["smart-tracker", "Smart Item Tracker 4-Pack", "Never lose keys, wallet or bags again.", "Tech", 99, ["Tech/Gadgets", "Travel", "Hustler"], ["adult"], "physical"],
  ["drawing-tablet", "Digital Drawing Tablet", "Pressure-sensitive pen tablet for digital art.", "Art", 79, ["Art/Design", "Creative", "Tech/Gadgets"], ["adult", "teen"], "physical"],
  ["watercolor-kit", "Artist Watercolor Kit", "48 pans, brushes and a cold-press sketchbook.", "Art", 45, ["Art/Design", "Creative", "DIY/Crafts"], ["adult", "teen", "child"], "physical"],
  ["herb-garden", "Indoor Smart Herb Garden", "Grows fresh basil and mint on the counter, year-round.", "Garden", 99, ["Gardening", "Cooking/Food", "Homebody", "Housewarming"], ["adult"], "physical"],
  ["garden-tool-set", "Ergonomic Garden Tool Set", "Rust-proof tools in a canvas tote.", "Garden", 49, ["Gardening", "Outdoorsy", "Grandparent"], ["adult"], "physical"],
  ["pottery-class", "Pottery Wheel Workshop", "A beginner wheel-throwing session — they keep what they make.", "Experiences", 85, ["DIY/Crafts", "Creative", "Art/Design"], ["adult", "teen"], "experience"],
  ["candle-making-kit", "Candle Making Kit", "Soy wax, scents and tins to pour their own candles.", "Crafts", 32, ["DIY/Crafts", "Creative", "Home Decor", "Homebody"], ["adult", "teen"], "physical"],
  ["pet-portrait", "Custom Pet Portrait", "Their pet, hand-illustrated and framed.", "Pets", 70, ["Pets/Animals", "Home Decor", "Creative"], ["adult", "teen"], "physical"],
  ["pet-camera", "Treat-Tossing Pet Camera", "Check in and toss treats from anywhere.", "Pets", 129, ["Pets/Animals", "Tech/Gadgets"], ["adult"], "physical"],
  ["streaming-card", "Streaming Gift Card", "A few months of their favourite movies and shows.", "Gift Cards", 50, ["Movies/TV", "Homebody"], ["adult", "teen"], "giftcard"],
  ["projector", "Mini Home Projector", "Turns any wall into a 100-inch movie screen.", "Tech", 159, ["Movies/TV", "Tech/Gadgets", "Homebody", "Social Butterfly"], ["adult", "teen"], "physical"],
  ["track-day", "Supercar Driving Experience", "Laps behind the wheel of a real supercar.", "Experiences", 299, ["Cars/Motorsports", "Outdoorsy"], ["adult"], "experience"],
  ["car-detailing-kit", "Car Detailing Kit", "Everything for a showroom shine at home.", "Auto", 59, ["Cars/Motorsports", "Dad", "Father's Day"], ["adult"], "physical"],
  ["throw-blanket", "Chunky Knit Throw Blanket", "Hand-knit, impossibly soft, perfect for the sofa.", "Home", 79, ["Home Decor", "Homebody", "Housewarming", "Grandparent"], ["adult"], "physical"],
  ["gratitude-journal", "Guided Gratitude Journal", "Five minutes a day of reflection and calm.", "Wellness", 22, ["Spirituality/Faith", "Wellness-focused", "Intellectual", "Thank You", "Sympathy"], ["adult", "teen"], "physical"],
  ["instant-camera", "Instant Camera Bundle", "Prints photos on the spot — film included.", "Photography", 89, ["Photography", "Social Butterfly", "Trendsetter", "Creative"], ["adult", "teen"], "physical"],
  ["photo-book", "Custom Photo Book", "Their favourite memories printed in a hardcover book.", "Photography", 45, ["Photography", "Partner", "Grandparent", "Anniversary", "Mom"], ["adult"], "physical"],
  ["cocktail-kit", "Craft Cocktail Kit", "Shaker, jigger and recipes for bar-quality drinks.", "Drinks", 55, ["Wine/Cocktails", "Social Butterfly", "Housewarming"], ["adult"], "physical"],
  ["wine-tasting", "Vineyard Wine Tasting for Two", "Guided tasting and tour at a local winery.", "Experiences", 120, ["Wine/Cocktails", "Partner", "Anniversary"], ["adult"], "experience"],
  ["spa-day", "Spa Day Gift Card", "A massage, facial or full day of pampering.", "Experiences", 150, ["Wellness-focused", "Mom", "Mother's Day", "Get Well", "Partner"], ["adult"], "experience"],
  ["visa-gift-card", "Prepaid Visa Gift Card", "Spend it anywhere — the ultimate flexible gift.", "Gift Cards", 100, ["Coworker/Boss", "Graduation", "Wedding", "Thank You"], ["adult", "teen"], "giftcard"],
  ["lego-set", "Creative Building Brick Set", "1,000 colorful bricks for endless builds.", "Toys", 59, ["Child", "DIY/Crafts", "Creative", "Gaming"], ["child", "teen"], "physical"],
  ["plush-toy", "Giant Cuddly Plush Bear", "A huggable best friend, machine-washable.", "Toys", 35, ["Child", "Baby Shower", "Pets/Animals"], ["child"], "physical"],
  ["kids-science-kit", "Kids Science Lab Kit", "30 safe experiments — volcanoes, slime and crystals.", "Toys", 40, ["Child", "Intellectual", "DIY/Crafts"], ["child"], "physical"],
  ["baby-gift-basket", "Organic Baby Gift Basket", "Swaddles, rattle and soft booties.", "Baby", 75, ["Baby Shower", "Child"], ["child"], "physical"],
  ["kids-scooter", "Light-Up Kids Scooter", "LED wheels and adjustable height for ages 3–12.", "Toys", 69, ["Child", "Sports/Fitness", "Outdoorsy"], ["child"], "physical"],
  ["desk-plant", "Low-Maintenance Desk Plant", "A cheerful succulent in a ceramic pot.", "Home", 24, ["Coworker/Boss", "Gardening", "Thank You", "Housewarming"], ["adult"], "physical"],
  ["coffee-sampler", "Specialty Coffee Sampler", "Six single-origin roasts from around the world.", "Drinks", 42, ["Cooking/Food", "Coworker/Boss", "Hustler", "Christmas/Holiday"], ["adult"], "physical"],
  ["weekend-getaway", "Weekend Getaway Voucher", "Two nights at a boutique hotel of their choice.", "Experiences", 450, ["Travel", "Partner", "Anniversary", "Wedding"], ["adult"], "experience"],
  ["designer-watch", "Minimalist Designer Watch", "Sapphire glass, Italian leather strap, timeless style.", "Accessories", 320, ["Fashion/Beauty", "Trendsetter", "Hustler", "Graduation", "Anniversary"], ["adult"], "physical"],
  ["espresso-machine", "Barista Espresso Machine", "Café-quality espresso and frothed milk at home.", "Kitchen", 549, ["Cooking/Food", "Homebody", "Wedding", "Housewarming"], ["adult"], "physical"],
];

export const starterCatalog: Product[] = rows.map(([id, title, description, category, price, tags, ageGroups, giftType]) => ({
  id,
  title,
  description,
  category,
  price,
  currency: "USD",
  tags,
  ageGroups,
  giftType,
  imageUrl: null,
  // Search URLs are not valid BUY THIS targets — use amazon-catalog ASINs for shoppable fallbacks.
  buyUrl: "",
  provider: "starter",
  popularity: 0,
}));

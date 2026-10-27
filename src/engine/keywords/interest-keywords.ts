/**
 * Map questionnaire interest / vibe labels → Amazon-style product keywords.
 * Keep tokens short and shoppable — no filler like "gift", "ideas", year.
 */

export type InterestKeywordSet = {
  /** Primary product search terms (best first). */
  primary: string[];
  /** Premium / wow angles for the same interest. */
  premium: string[];
  /** Practical / everyday angles. */
  practical: string[];
};

const INTEREST_MAP: Record<string, InterestKeywordSet> = {
  "Cooking/Food": {
    primary: ["kitchen gadgets", "cookware set", "chef knife"],
    premium: ["premium cookware", "espresso machine", "stand mixer"],
    practical: ["meal prep containers", "air fryer accessories", "cutting board"],
  },
  "Sports/Fitness": {
    primary: ["fitness equipment", "workout gear", "resistance bands"],
    premium: ["smart watch fitness", "adjustable dumbbells", "massage gun"],
    practical: ["yoga mat", "water bottle insulated", "gym bag"],
  },
  Music: {
    primary: ["bluetooth headphones", "wireless earbuds", "portable speaker"],
    premium: ["noise cancelling headphones", "turntable", "studio headphones"],
    practical: ["phone speaker", "earbud case", "music streaming gift card"],
  },
  Gaming: {
    primary: ["gaming headset", "wireless controller", "gaming mouse"],
    premium: ["gaming keyboard mechanical", "gaming monitor", "console headset"],
    practical: ["controller charger", "gaming mouse pad", "headset stand"],
  },
  Reading: {
    primary: ["kindle e-reader", "book light", "hardcover bestsellers"],
    premium: ["ebook reader leather case", "luxury bookmark set", "audiobook subscription"],
    practical: ["book stand", "reading glasses", "bookmark set"],
  },
  Travel: {
    primary: ["travel backpack", "packing cubes", "noise cancelling earbuds travel"],
    premium: ["carry on luggage", "travel pillow luxury", "portable charger high capacity"],
    practical: ["passport holder", "toiletry bag", "luggage tag"],
  },
  "Fashion/Beauty": {
    primary: ["skincare set", "hair styling tool", "makeup brush set"],
    premium: ["luxury skincare set", "dyson style hair tool", "gold jewelry gift"],
    practical: ["face moisturizer", "hair dryer brush", "nail care kit"],
  },
  "Tech/Gadgets": {
    primary: ["wireless charger", "portable power bank", "smart home gadget"],
    premium: ["noise cancelling headphones", "tablet", "smart watch"],
    practical: ["phone case", "usb-c hub", "cable organizer"],
  },
  "Art/Design": {
    primary: ["art supplies set", "sketchbook", "drawing tablet"],
    premium: ["professional markers", "watercolor set", "calligraphy set"],
    practical: ["colored pencils", "desk easel", "craft storage"],
  },
  Gardening: {
    primary: ["gardening tools set", "indoor plant pots", "seed starter kit"],
    premium: ["raised garden bed", "pruning shears", "grow light indoor"],
    practical: ["garden gloves", "watering can", "plant food"],
  },
  "DIY/Crafts": {
    primary: ["craft kit", "sewing kit", "tool set DIY"],
    premium: ["cricut machine", "woodworking tools", "resin craft kit"],
    practical: ["glue gun kit", "craft organization", "paint set"],
  },
  "Pets/Animals": {
    primary: ["dog toys", "pet bed", "cat scratching post"],
    premium: ["automatic pet feeder", "pet camera", "orthopedic dog bed"],
    practical: ["pet grooming brush", "treat puzzle", "leash harness"],
  },
  "Movies/TV": {
    primary: ["streaming device", "bluetooth soundbar", "popcorn maker"],
    premium: ["4k streaming stick", "home theater headphones", "projector portable"],
    practical: ["tv remote holder", "movie snack set", "streaming gift card"],
  },
  "Cars/Motorsports": {
    primary: ["car phone mount", "car detailing kit", "dash cam"],
    premium: ["car vacuum", "wireless car charger", "tire inflator"],
    practical: ["car organizer", "microfiber cloths car", "air freshener car"],
  },
  "Home Decor": {
    primary: ["home decor accents", "picture frames set", "desk lamp"],
    premium: ["smart lighting", "decorative vase", "wall art print"],
    practical: ["storage baskets", "essential oil diffuser", "shelf organizer"],
  },
  "Spirituality/Faith": {
    primary: ["meditation cushion", "journal gratitude", "essential oil diffuser"],
    premium: ["singing bowl", "yoga meditation kit", "inspirational wall art"],
    practical: ["prayer journal", "calm lighting", "mindfulness cards"],
  },
  Photography: {
    primary: ["phone camera lens kit", "tripod", "camera bag"],
    premium: ["mirrorless camera", "photography lighting", "drone camera"],
    practical: ["sd card", "lens cleaning kit", "phone gimbal"],
  },
  "Wine/Cocktails": {
    primary: ["cocktail shaker set", "wine glasses", "bar tool set"],
    premium: ["electric wine opener", "whiskey stones set", "home bar kit"],
    practical: ["bottle stopper", "wine aerator", "cocktail recipe book"],
  },
};

const VIBE_KEYWORDS: Record<string, string[]> = {
  Homebody: ["cozy home", "indoor comfort"],
  Outdoorsy: ["outdoor adventure", "camping gear"],
  Creative: ["creative hobby", "art craft"],
  Hustler: ["productivity desk", "organization office"],
  "Social Butterfly": ["party host", "entertaining home"],
  Intellectual: ["educational", "puzzle brain"],
  Trendsetter: ["trendy fashion accessory", "viral beauty"],
  "Wellness-focused": ["self care", "wellness kit"],
};

/** Path E “What are they like?” → shoppable Amazon phrases (never bare adjectives). */
const PERSONALITY_KEYWORDS: Record<string, InterestKeywordSet> = {
  Creative: {
    primary: ["art supply set", "sketchbook journal", "creative craft kit"],
    premium: ["drawing tablet", "calligraphy pen set", "watercolor paint set"],
    practical: ["desk organizer creative", "portable sketch kit", "craft storage box"],
  },
  Active: {
    primary: ["fitness resistance bands", "workout water bottle", "yoga mat thick"],
    premium: ["massage gun", "smart fitness watch", "adjustable dumbbells"],
    practical: ["gym bag duffel", "running armband", "foam roller"],
  },
  Minimalist: {
    primary: ["minimalist desk lamp", "simple ceramic vase", "clean linen throw"],
    premium: ["quality leather wallet", "minimalist watch", "linen bedding set"],
    practical: ["cable organizer", "slim notebook", "neutral home accent"],
  },
  "Tech-savvy": {
    primary: ["wireless charger stand", "portable power bank", "smart home plug"],
    premium: ["noise cancelling headphones", "tablet stand adjustable", "smart speaker"],
    practical: ["usb-c hub", "phone tripod", "cable management kit"],
  },
  Sentimental: {
    primary: ["personalized photo frame", "custom jewelry necklace", "memory journal"],
    premium: ["engraved keepsake box", "star map print", "personalized blanket"],
    practical: ["photo album book", "keepsake journal", "custom mug"],
  },
  "Trendy and fashion-forward": {
    primary: ["trendy fashion accessory", "statement earrings", "designer inspired bag"],
    premium: ["luxury scarf", "gold plated jewelry", "designer sunglasses"],
    practical: ["hair styling tool", "fashion jewelry set", "crossbody bag"],
  },
  "Loves to read": {
    primary: ["kindle paperwhite", "book light clip", "hardcover novel set"],
    premium: ["ebook reader case leather", "audiobook subscription card", "reading nook pillow"],
    practical: ["bookmark set metal", "book stand adjustable", "reading glasses"],
  },
  Homebody: {
    primary: ["cozy throw blanket", "essential oil diffuser", "weighted blanket"],
    premium: ["luxury robe set", "smart lighting bulb", "plush loungewear"],
    practical: ["fuzzy socks set", "candle gift set", "tea gift set"],
  },
  Outdoorsy: {
    primary: ["camping lantern rechargeable", "hiking daypack", "insulated tumbler outdoor"],
    premium: ["portable camping stove", "binoculars compact", "sleeping bag lightweight"],
    practical: ["trail mix gift", "pocket multi tool", "waterproof phone pouch"],
  },
  Foodie: {
    primary: ["artisan food gift basket", "gourmet olive oil set", "specialty spice set"],
    premium: ["espresso machine", "cast iron skillet", "sous vide cooker"],
    practical: ["cheese board set", "hot sauce gift set", "coffee sampler"],
  },
  "Music lover": {
    primary: ["bluetooth headphones", "portable bluetooth speaker", "vinyl record stand"],
    premium: ["noise cancelling headphones", "turntable starter", "studio monitor headphones"],
    practical: ["earbud case", "guitar accessories", "music streaming gift card"],
  },
  Gamer: {
    primary: ["gaming headset wireless", "mechanical gaming keyboard", "controller charger"],
    premium: ["gaming monitor", "racing wheel", "gaming chair"],
    practical: ["mouse pad xl", "headset stand", "controller skin"],
  },
  "Wellness-focused": {
    primary: ["self care gift set", "massage pillow", "yoga mat cork"],
    premium: ["massage gun", "sauna blanket", "premium skincare set"],
    practical: ["bath bomb set", "aromatherapy diffuser", "meditation cushion"],
  },
  "Career-driven": {
    primary: ["leather portfolio", "desk organizer set", "noise cancelling earbuds work"],
    premium: ["premium briefcase", "standing desk converter", "executive pen set"],
    practical: ["laptop sleeve", "notebook planner", "wireless mouse"],
  },
  "Funny and witty": {
    primary: ["funny coffee mug", "punny desk toy", "quirky home decor"],
    premium: ["novelty gadget fun", "comedy board game", "personalized funny print"],
    practical: ["joke book", "funny socks", "desk stress toy"],
  },
  Romantic: {
    primary: ["personalized jewelry", "couple photo frame", "luxury candle set"],
    premium: ["spa gift basket", "silk pillowcase set", "engraved necklace"],
    practical: ["love notes jar", "romantic board game", "bath salts set"],
  },
  "Spiritual or mindful": {
    primary: ["meditation cushion", "singing bowl set", "gratitude journal"],
    premium: ["crystal set gift", "yoga meditation kit", "essential oil set"],
    practical: ["mindfulness cards", "incense holder", "calm lighting lamp"],
  },
  "Pet parent": {
    primary: ["pet bed orthopedic", "interactive dog toy", "cat tree tower"],
    premium: ["automatic pet feeder", "pet camera treat", "designer pet collar"],
    practical: ["pet grooming kit", "treat puzzle toy", "leash harness set"],
  },
  "DIY and maker": {
    primary: ["tool set home", "craft kit adult", "woodworking starter kit"],
    premium: ["cricut machine", "rotary tool kit", "resin art kit"],
    practical: ["glue gun kit", "organizer toolbox", "paint set acrylic"],
  },
  "Luxury-oriented": {
    primary: ["luxury skincare set", "cashmere scarf", "premium watch"],
    premium: ["designer fragrance", "silk robe", "leather weekender bag"],
    practical: ["luxury candle", "quality leather wallet", "silk pillowcase"],
  },
  Practical: {
    primary: ["multi tool kit", "portable power bank", "insulated tumbler"],
    premium: ["robot vacuum", "air purifier", "quality luggage"],
    practical: ["cable organizer", "first aid kit home", "label maker"],
  },
  "Social butterfly": {
    primary: ["party hosting set", "board game party", "entertaining serving set"],
    premium: ["cocktail shaker set", "outdoor string lights", "karaoke microphone"],
    practical: ["playing cards set", "hostess gift set", "ice bucket set"],
  },
  Intellectual: {
    primary: ["puzzle brain challenge", "strategy board game", "nonfiction bestseller"],
    premium: ["telescope beginner", "chess set wooden", "kindle oasis"],
    practical: ["trivia game", "science kit adult", "magazine subscription card"],
  },
  "Eco-conscious": {
    primary: ["reusable bottle set", "bamboo utensil kit", "organic skincare set"],
    premium: ["solar charger", "compost bin kitchen", "organic cotton bedding"],
    practical: ["beeswax wraps", "reusable shopping bags", "plant based candle"],
  },
  Nostalgic: {
    primary: ["retro vinyl player", "vintage style camera", "classic board game"],
    premium: ["polaroid instant camera", "record player bluetooth", "nostalgia candy gift"],
    practical: ["retro poster print", "vintage puzzle", "classic novel set"],
  },
  "Sports fan": {
    primary: ["team jersey gift", "sports memorabilia", "stadium blanket"],
    premium: ["autograph ball display", "premium sports watch", "team gear set"],
    practical: ["sports tumbler", "fan scarf", "game day snacks set"],
  },
  Traveler: {
    primary: ["packing cubes set", "travel backpack", "noise cancelling earbuds travel"],
    premium: ["carry on luggage", "travel neck pillow luxury", "portable luggage scale"],
    practical: ["passport holder", "toiletry bag hang", "universal travel adapter"],
  },
  Gardener: {
    primary: ["gardening tool set", "indoor plant pots", "grow light indoor"],
    premium: ["raised garden bed", "pruning shears premium", "hydroponic starter"],
    practical: ["garden gloves", "watering can", "seed starter kit"],
  },
  "Movie and TV buff": {
    primary: ["streaming stick 4k", "popcorn maker home", "bluetooth soundbar"],
    premium: ["portable projector", "home theater headphones", "movie snack gift set"],
    practical: ["tv remote organizer", "streaming gift card", "cozy movie blanket"],
  },
  "Wine and cocktails": {
    primary: ["cocktail shaker set", "wine glass set", "bar tool kit"],
    premium: ["electric wine opener", "whiskey stones set", "home bar cart set"],
    practical: ["wine aerator", "bottle stopper set", "cocktail recipe cards"],
  },
};

/** Resolve personality label → keyword set (exact then fuzzy). */
export function keywordsForPersonality(label: string): InterestKeywordSet {
  const exact = PERSONALITY_KEYWORDS[label];
  if (exact) return exact;
  const lower = label.toLowerCase();
  const key = Object.keys(PERSONALITY_KEYWORDS).find((k) => {
    const kl = k.toLowerCase();
    return lower.includes(kl) || kl.includes(lower) || lower.split(/\s+/).some((w) => w.length > 3 && kl.includes(w));
  });
  if (key) return PERSONALITY_KEYWORDS[key]!;
  return {
    primary: ["thoughtful gift set", "premium everyday accessory", "quality home accent"],
    premium: ["luxury gift basket", "personalized keepsake", "premium tech gadget"],
    practical: ["useful everyday item", "quality tumbler", "desk organizer"],
  };
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "they",
  "them",
  "their",
  "have",
  "has",
  "want",
  "wants",
  "like",
  "likes",
  "love",
  "loves",
  "really",
  "something",
  "anything",
  "gift",
  "gifts",
  "please",
  "just",
  "also",
  "about",
  "into",
  "over",
  "under",
  "dont",
  "don't",
  "know",
  "idea",
  "ideas",
]);

/** Normalize questionnaire interest label → keyword set. */
export function keywordsForInterest(interest: string): InterestKeywordSet {
  const exact = INTEREST_MAP[interest];
  if (exact) return exact;
  // Fuzzy: "Cooking" in "Cooking/Food"
  const key = Object.keys(INTEREST_MAP).find((k) =>
    interest.toLowerCase().includes(k.split("/")[0]!.toLowerCase()),
  );
  if (key) return INTEREST_MAP[key]!;
  const cleaned = interest
    .replace(/[/&]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    primary: [cleaned || "popular gift"],
    premium: [`premium ${cleaned}`.trim()],
    practical: [`useful ${cleaned}`.trim()],
  };
}

export function keywordsForVibe(vibe: string): string[] {
  return VIBE_KEYWORDS[vibe] ?? [];
}

/** Pull shoppable tokens from free-text "wants". */
export function tokensFromWants(wants: string): string[] {
  if (!wants?.trim()) return [];
  return wants
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 6);
}

/** All searchable tokens for a product-fit check against answers. */
export function answerSearchTokens(
  interests: string[],
  vibe: string,
  wants: string,
  personalities: string[] = [],
): string[] {
  const out: string[] = [];
  for (const interest of interests) {
    const set = keywordsForInterest(interest);
    out.push(...set.primary, ...set.premium, ...set.practical);
    out.push(
      ...interest
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2),
    );
  }
  for (const p of personalities) {
    const set = keywordsForPersonality(p);
    out.push(...set.primary, ...set.premium, ...set.practical);
  }
  out.push(...keywordsForVibe(vibe));
  out.push(...tokensFromWants(wants));
  return [...new Set(out.map((t) => t.toLowerCase().trim()).filter(Boolean))];
}

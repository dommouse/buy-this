import { parseClaudeGifts } from "../src/engine/ai/claude-suggest.server.ts";

const sample = JSON.stringify({
  tip: "Wrap it with a handwritten note.",
  gifts: [
    {
      title: "Kindle Paperwhite",
      description: "Glare-free e-reader for book lovers.",
      category: "Books",
      price: 139,
      reason: "Matches their reading interest.",
      tags: ["Reading", "Travel"],
      giftType: "physical",
      asin: "B0CFPJYX7P",
      searchQuery: "Kindle Paperwhite",
    },
    {
      title: "Local Pottery Class",
      description: "Hands-on creative experience.",
      category: "Experiences",
      price: 95,
      reason: "A memorable creative outing.",
      giftType: "experience",
      merchantUrl: "https://www.airbnb.com/experiences",
    },
    {
      title: "Echo Pop",
      description: "Compact smart speaker.",
      category: "Tech",
      price: 39,
      reason: "Practical tech for homebodies.",
      tags: ["Tech/Gadgets", "Homebody"],
      giftType: "physical",
      asin: "B09ZX86WB4",
    },
    {
      title: "Amazon Gift Card",
      description: "Let them pick exactly what they want.",
      category: "Gift Cards",
      price: 50,
      reason: "Flexible when interests are mixed.",
      giftType: "giftcard",
      asin: "B014WCGUVS",
    },
  ],
});

const parsed = parseClaudeGifts(sample, "adult", "test-session", 4);
if (!parsed || parsed.items.length < 3) {
  console.error("FAIL: expected >=3 gifts", parsed);
  process.exit(1);
}
const shop = parsed.items.filter((i) => i.product.giftType !== "experience");
if (!shop.every((i) => /\/dp\//.test(i.product.buyUrl) && i.product.imageUrl)) {
  console.error(
    "FAIL: shop goods need PDP + image",
    shop.map((i) => ({ title: i.product.title, buyUrl: i.product.buyUrl, imageUrl: i.product.imageUrl })),
  );
  process.exit(1);
}
console.log(
  "OK",
  parsed.items.map((i) => `${i.product.provider}:${i.product.giftType}:${i.product.title}`),
);

import { parseClaudeGifts } from "../src/engine/ai/claude-suggest.server.ts";

const sample = JSON.stringify({
  tip: "Wrap it with a handwritten note.",
  gifts: [
    {
      title: "Polaroid Camera Kit",
      description: "Instant photos for creative friends.",
      category: "Photography",
      price: 89,
      reason: "Matches their creative photo vibe.",
      tags: ["Photography", "Creative"],
      giftType: "physical",
      searchQuery: "Polaroid camera kit",
    },
    {
      title: "Weekend Pottery Class",
      description: "Hands-on creative experience.",
      category: "Experiences",
      price: 95,
      reason: "A memorable creative outing.",
      giftType: "experience",
      searchQuery: "pottery class for two",
    },
    {
      title: "Artist Sketch Set",
      description: "Quality pencils and paper pad.",
      category: "Art",
      price: 42,
      reason: "Practical for their art habit.",
      giftType: "physical",
      searchQuery: "artist sketch pencil set",
    },
    {
      title: "Neon Light Sign Kit",
      description: "DIY LED word art.",
      category: "Home",
      price: 55,
      reason: "Unexpected and fun for creatives.",
      giftType: "physical",
      searchQuery: "DIY neon light sign kit",
    },
  ],
});

const parsed = parseClaudeGifts(sample, "adult", "test-session", 4);
if (!parsed || parsed.items.length !== 4) {
  console.error("FAIL: expected 4 gifts", parsed);
  process.exit(1);
}
if (!parsed.items.every((i) => i.product.buyUrl.includes("amazon.com"))) {
  console.error("FAIL: buy URLs", parsed.items.map((i) => i.product.buyUrl));
  process.exit(1);
}
console.log(
  "OK",
  parsed.items.map((i) => `${i.product.provider}: ${i.product.title}`),
);

import { recommend } from "../src/engine/recommend.server.ts";

const r = await recommend(
  {
    relationship: "Friend",
    occasion: "Birthday",
    ageRange: "26-30",
    gender: "Female",
    vibe: "Creative",
    interests: ["Art/Design", "Music"],
    wants: "",
    avoid: "",
    budget: "$50-$100",
    hasKids: "No",
    giftType: "Something to Unwrap",
  },
  { searchId: null, sessionId: "smoke" },
);

console.log(
  JSON.stringify(
    {
      strategy: r.strategy,
      tip: r.tip,
      items: r.items.map((i) => ({
        slot: i.slot,
        title: i.product.title,
        price: i.product.price,
        reason: i.reason,
      })),
    },
    null,
    2,
  ),
);

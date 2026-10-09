import { extractProfileFeatures } from "../src/engine/features/profile";
import { findBlockHits } from "../src/engine/keywords/filter";

const profile = {
  relationship: "Partner",
  occasion: "Valentine's Day",
  ageRange: "25-34",
  gender: "Woman",
  vibe: "Trendsetter",
  interests: ["Cooking/Food", "Fashion/Beauty"],
  wants: "",
  avoid: "mugs",
  budget: "$50-$100",
  hasKids: "",
  giftType: "Something to Unwrap",
};

const f = extractProfileFeatures(profile);
const cases = [
  "trending kitchen gadget stylish women 2026 under 100",
  "trending fashion accessory stylish women 2026 under 100",
  "cute coffee mug for her birthday",
];
for (const phrase of cases) {
  console.log(phrase, "→", findBlockHits(phrase, profile, f).map((h) => h.ruleId).join(",") || "(clean)");
}

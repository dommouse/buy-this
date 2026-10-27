/**
 * Claude slot picker retired — Gift Brain picks via answer-fit + trending in
 * keyword-recommend.server.ts (pickFourSlots).
 */
import type { ProfileFeatures } from "../features/profile";
import type { Product, RecipientProfile, Recommendation, Slot } from "../types";

export class AiUnavailableError extends Error {}

export async function pickSlotsWithClaude(_input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  bySlot: Map<Slot, Product[]>;
  phrases: { slot: Slot; phrase: string; angle: string }[];
}): Promise<{ tip: string | null; items: Recommendation[] } | null> {
  throw new AiUnavailableError("Claude slot picker disabled — Gift Brain picks locally");
}

/**
 * Hybrid Claude step: ONLY final 4 picks + Gift Tips from a shortlist.
 * Never builds search phrases. Gated by ENGINE_USE_AI + API key.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { engineConfig } from "../config";
import type { Product, RecipientProfile, Recommendation, Slot } from "../types";
import { SLOTS } from "../scoring/ranker";
import { engineLog, engineWarn } from "../utils/logger";

export class AiUnavailableError extends Error {}

const anthropic = createAnthropic({
  apiKey: engineConfig.anthropicApiKey || "missing",
});

export async function claudeFinalPick(input: {
  profile: RecipientProfile;
  candidates: Product[];
  photoDataUrl?: string | null;
}): Promise<{ tip: string | null; items: Recommendation[] } | null> {
  if (!engineConfig.useAi || !engineConfig.anthropicApiKey) return null;
  if (input.candidates.length < 4) return null;

  const shortlist = input.candidates.slice(0, 25).map((p, i) => ({
    i,
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category,
  }));

  const system =
    "You are Dominique, Gift Brain for BUY THIS. Pick exactly ONE product per slot " +
    "(The One, The Wow, The Smart Pick, The Wildcard) from the candidate list by id. " +
    "Write a short Gift Tip about presenting THAT product (wrapping/timing). " +
    "Return JSON only: { tip: string, picks: [{ slot, productId, reason }] }.";

  const payload = {
    answers: {
      relationship: input.profile.relationship,
      occasion: input.profile.occasion,
      age: input.profile.ageRange,
      interests: input.profile.interests,
      personality: input.profile.personality,
      budget: input.profile.budget,
      talkAbout: input.profile.talkAbout,
      wants: input.profile.wants,
      path: input.profile.path,
    },
    hasPhoto: Boolean(input.photoDataUrl),
    candidates: shortlist,
    slots: SLOTS,
  };

  try {
    engineLog("engine: Claude final pick (hybrid)");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const { text } = await generateText({
      model: anthropic(engineConfig.claudeModel || "claude-sonnet-4-5-20250929"),
      system,
      prompt: JSON.stringify(payload),
      abortSignal: controller.signal,
    });
    clearTimeout(timer);

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      tip?: string;
      picks?: { slot: Slot; productId: string; reason: string }[];
    };
    const byId = new Map(input.candidates.map((p) => [p.id, p]));
    const items: Recommendation[] = [];
    const used = new Set<string>();
    for (const slot of SLOTS) {
      const pick = parsed.picks?.find((p) => p.slot === slot);
      const product = pick ? byId.get(pick.productId) : undefined;
      if (!product || used.has(product.id)) continue;
      used.add(product.id);
      items.push({
        slot,
        rank: items.length + 1,
        product,
        score: 0.9,
        reason: pick?.reason || "Dominique matched this to their answers",
      });
    }
    if (items.length < 4) return null;
    return { tip: parsed.tip || null, items: items.slice(0, 4) };
  } catch (err) {
    engineWarn("engine: Claude final pick failed", err);
    return null;
  }
}

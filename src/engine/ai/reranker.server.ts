import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { engineConfig } from "../config";
import { SLOTS } from "../scoring/ranker";
import type { RecipientProfile, ScoredProduct, Slot } from "../types";

export type AiPick = { slot: Slot; productId: string; reason: string };
export type AiRerankResult = { picks: AiPick[]; tip: string | null };

/** Thrown for gateway errors the caller should not retry (credits, denial). */
export class AiUnavailableError extends Error {}

/**
 * Legacy catalog shortlist re-ranker (Lovable AI gateway).
 * Used only when ENGINE_MODE=catalog-hybrid.
 */
export async function aiRerank(profile: RecipientProfile, shortlist: ScoredProduct[]): Promise<AiRerankResult | null> {
  const apiKey = engineConfig.lovableApiKey;
  if (!engineConfig.useAi || !apiKey || shortlist.length < 4) return null;

  const provider = createOpenAI({
    baseURL: engineConfig.lovableGatewayUrl,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const candidates = shortlist.map((s) => ({
    id: s.product.id,
    title: s.product.title,
    price: s.product.price,
    category: s.product.category,
    description: s.product.description,
    score: Number(s.score.toFixed(3)),
  }));

  const result = streamText({
    model: provider.responses(engineConfig.lovableModel),
    maxRetries: 0,
    system:
      "You are Dominique, a warm, witty gift concierge. Choose gifts ONLY from the candidate list. " +
      "Respect the budget, the 'avoid' notes and the recipient's age. Candidate scores come from a ranking model; prefer higher scores unless free-text answers clearly suggest otherwise. " +
      `Return only JSON: {"picks":[{"slot":"The One|The Wow|The Smart Pick|The Wildcard","productId":"...","reason":"one sentence, max 25 words, addressed to the shopper"}],"tip":"one presentation tip, max 30 words"}. ` +
      "Exactly four picks, one per slot, four different products. The One = best fit; The Wow = showstopper; The Smart Pick = practical and thoughtful; The Wildcard = unexpected surprise.",
    prompt: JSON.stringify({ recipient: profile, candidates }),
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
  });

  let text: string;
  try {
    text = await result.text;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 402 || status === 403) throw new AiUnavailableError(`AI gateway returned ${status}`);
    throw err;
  }
  return parsePicks(text, new Set(candidates.map((c) => c.id)));
}

export function parsePicks(text: string, validIds: Set<string>): AiRerankResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as { picks?: AiPick[]; tip?: string };
    const used = new Set<string>();
    const picks: AiPick[] = [];
    for (const slot of SLOTS) {
      const p = raw.picks?.find((x) => x.slot === slot && validIds.has(x.productId) && !used.has(x.productId));
      if (!p) return null;
      used.add(p.productId);
      picks.push({ slot, productId: p.productId, reason: String(p.reason ?? "").slice(0, 220) });
    }
    return { picks, tip: typeof raw.tip === "string" ? raw.tip.slice(0, 260) : null };
  } catch {
    return null;
  }
}

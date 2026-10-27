/**
 * Claude invent path retired — use Gift Brain (keyword-recommend.server.ts).
 */
import type { ProfileFeatures } from "../features/profile";
import type { Recommendation, RecipientProfile } from "../types";

export class AiUnavailableError extends Error {}

export type SegmentInsight = {
  productId: string;
  title: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type ClaudeSuggestResult = {
  tip: string | null;
  items: Recommendation[];
};

export async function claudeSuggestGifts(_input: {
  profile: RecipientProfile;
  features: ProfileFeatures;
  insights: SegmentInsight[];
  sessionId: string | null;
}): Promise<ClaudeSuggestResult | null> {
  throw new AiUnavailableError("Claude is disabled — Gift Brain uses local search + scoring");
}

export function parseClaudeGifts(
  _text: string,
  _features: ProfileFeatures,
  _sessionId: string | null,
  _count: number,
): ClaudeSuggestResult | null {
  return null;
}

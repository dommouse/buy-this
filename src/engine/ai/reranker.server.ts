/**
 * Lovable gateway re-ranker retired with Claude.
 */
import type { RecipientProfile, ScoredProduct } from "../types";

export class AiUnavailableError extends Error {}

export async function aiRerank(
  _profile: RecipientProfile,
  _shortlist: ScoredProduct[],
): Promise<{ tip: string | null; picks: { productId: string; slot: string; reason: string }[] } | null> {
  return null;
}

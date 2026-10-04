import { db } from "@/db/client";

export type InteractionType = "impression" | "click" | "buy_click" | "email_picks";

const untyped = db as unknown as { from: (t: string) => any };

/** Browser-side event logging. Never throws — tracking must not block the UI. */
export function trackInteraction(e: {
  type: InteractionType;
  productId?: string | null;
  recommendationId?: string | null;
  searchId?: string | null;
  sessionId?: string | null;
  rank?: number | null;
}) {
  void untyped
    .from("interaction_events")
    .insert({
      event_type: e.type,
      product_id: e.productId ?? null,
      recommendation_id: e.recommendationId ?? null,
      search_id: e.searchId ?? null,
      session_id: e.sessionId ?? null,
      rank: e.rank ?? null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("engine: event not tracked", error.message);
    });
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const profileSchema = z.object({
  relationship: z.string().max(100).default(""),
  occasion: z.string().max(100).default(""),
  ageRange: z.string().max(50).default(""),
  gender: z.string().max(50).default(""),
  vibe: z.string().max(100).default(""),
  interests: z.array(z.string().max(100)).max(10).default([]),
  wants: z.string().max(1000).default(""),
  avoid: z.string().max(1000).default(""),
  budget: z.string().max(50).default(""),
  hasKids: z.string().max(50).default(""),
  giftType: z.string().max(100).default(""),
});

const recommendInput = z.object({
  profile: profileSchema,
  searchId: z.string().uuid().nullable(),
  sessionId: z.string().max(100).nullable(),
});

/**
 * Streams progress events as the engine runs, then a final result.
 * Client prints each log to the browser console immediately and updates the status line.
 */
export const getRecommendations = createServerFn({ method: "POST" })
  .validator((data) => recommendInput.parse(data))
  .handler(async function* ({ data }) {
    const { recommendStream } = await import("./recommend.server");
    yield* recommendStream(data.profile, {
      searchId: data.searchId,
      sessionId: data.sessionId,
    });
  });

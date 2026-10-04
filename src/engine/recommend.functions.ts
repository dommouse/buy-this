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

export const getRecommendations = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ profile: profileSchema, searchId: z.string().uuid().nullable(), sessionId: z.string().max(100).nullable() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { recommend } = await import("./recommend.server");
    return recommend(data.profile, { searchId: data.searchId, sessionId: data.sessionId });
  });

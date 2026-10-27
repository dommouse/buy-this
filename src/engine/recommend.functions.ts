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
  path: z.string().max(5).optional(),
  personality: z.array(z.string().max(100)).max(5).optional(),
  parentType: z.string().max(100).optional(),
  helpWith: z.string().max(100).optional(),
  firstBaby: z.string().max(100).optional(),
  childStage: z.string().max(100).optional(),
  familyNeed: z.string().max(100).optional(),
  character: z.string().max(200).optional(),
  funOrLearning: z.string().max(100).optional(),
  teenStyle: z.string().max(100).optional(),
  wearUseDo: z.string().max(100).optional(),
  talkAbout: z.string().max(500).optional(),
  practicalOrSpecial: z.string().max(100).optional(),
  feelSeen: z.string().max(200).optional(),
  howBig: z.string().max(100).optional(),
  professionPride: z.string().max(100).optional(),
  howFeel: z.string().max(100).optional(),
  knowThem: z.string().max(100).optional(),
  favorites: z.string().max(100).optional(),
  entertain: z.string().max(100).optional(),
  homeType: z.string().max(100).optional(),
  neverBuy: z.string().max(100).optional(),
  graduationLevel: z.string().max(50).optional(),
  photoDataUrl: z.string().max(6_000_000).nullable().optional(),
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
    const p = data.profile;
    // Strip undefined optionals for exactOptionalPropertyTypes.
    const profile = {
      relationship: p.relationship,
      occasion: p.occasion,
      ageRange: p.ageRange,
      gender: p.gender,
      vibe: p.vibe,
      interests: p.interests,
      wants: p.wants,
      avoid: p.avoid,
      budget: p.budget,
      hasKids: p.hasKids,
      giftType: p.giftType,
      ...(p.path != null ? { path: p.path } : {}),
      ...(p.personality != null ? { personality: p.personality } : {}),
      ...(p.parentType != null ? { parentType: p.parentType } : {}),
      ...(p.helpWith != null ? { helpWith: p.helpWith } : {}),
      ...(p.firstBaby != null ? { firstBaby: p.firstBaby } : {}),
      ...(p.childStage != null ? { childStage: p.childStage } : {}),
      ...(p.familyNeed != null ? { familyNeed: p.familyNeed } : {}),
      ...(p.character != null ? { character: p.character } : {}),
      ...(p.funOrLearning != null ? { funOrLearning: p.funOrLearning } : {}),
      ...(p.teenStyle != null ? { teenStyle: p.teenStyle } : {}),
      ...(p.wearUseDo != null ? { wearUseDo: p.wearUseDo } : {}),
      ...(p.talkAbout != null ? { talkAbout: p.talkAbout } : {}),
      ...(p.practicalOrSpecial != null ? { practicalOrSpecial: p.practicalOrSpecial } : {}),
      ...(p.feelSeen != null ? { feelSeen: p.feelSeen } : {}),
      ...(p.howBig != null ? { howBig: p.howBig } : {}),
      ...(p.professionPride != null ? { professionPride: p.professionPride } : {}),
      ...(p.howFeel != null ? { howFeel: p.howFeel } : {}),
      ...(p.knowThem != null ? { knowThem: p.knowThem } : {}),
      ...(p.favorites != null ? { favorites: p.favorites } : {}),
      ...(p.entertain != null ? { entertain: p.entertain } : {}),
      ...(p.homeType != null ? { homeType: p.homeType } : {}),
      ...(p.neverBuy != null ? { neverBuy: p.neverBuy } : {}),
      ...(p.graduationLevel != null ? { graduationLevel: p.graduationLevel } : {}),
      ...(p.photoDataUrl !== undefined ? { photoDataUrl: p.photoDataUrl } : {}),
    };
    yield* recommendStream(profile, {
      searchId: data.searchId,
      sessionId: data.sessionId,
    });
  });

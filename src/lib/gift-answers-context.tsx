import { createContext, useContext, useState, type ReactNode } from "react";

import type { QuestionnairePath } from "@/questionnaire/types";

export type GiftPhoto = { name: string; type: string; size: number; dataUrl: string } | null;

/**
 * Answers from the path-routed questionnaire.
 * Legacy fields (gender, vibe, wants, avoid, hasKids, giftType) kept for engine compat.
 */
export type GiftAnswers = {
  path: QuestionnairePath | "";
  occasion: string;
  occasionOther: string;
  relationship: string;
  relationshipOther: string;
  ageRange: string;
  graduationLevel: string;
  budget: string;
  gender: string;
  vibe: string;
  interests: string[];
  personality: string[];
  wants: string;
  avoid: string;
  hasKids: string;
  giftType: string;
  /** Path A */
  firstBaby: string;
  parentType: string;
  helpWith: string;
  /** Path B/C */
  childStage: string;
  familyNeed: string;
  character: string;
  funOrLearning: string;
  /** Path D */
  teenStyle: string;
  wearUseDo: string;
  /** Path E */
  talkAbout: string;
  practicalOrSpecial: string;
  feelSeen: string;
  howBig: string;
  professionPride: string;
  howFeel: string;
  /** Path F */
  knowThem: string;
  favorites: string;
  /** Path G */
  entertain: string;
  homeType: string;
  neverBuy: string;
  photo: GiftPhoto;
};

export const emptyAnswers: GiftAnswers = {
  path: "",
  occasion: "",
  occasionOther: "",
  relationship: "",
  relationshipOther: "",
  ageRange: "",
  graduationLevel: "",
  budget: "",
  gender: "",
  vibe: "",
  interests: [],
  personality: [],
  wants: "",
  avoid: "",
  hasKids: "",
  giftType: "",
  firstBaby: "",
  parentType: "",
  helpWith: "",
  childStage: "",
  familyNeed: "",
  character: "",
  funOrLearning: "",
  teenStyle: "",
  wearUseDo: "",
  talkAbout: "",
  practicalOrSpecial: "",
  feelSeen: "",
  howBig: "",
  professionPride: "",
  howFeel: "",
  knowThem: "",
  favorites: "",
  entertain: "",
  homeType: "",
  neverBuy: "",
  photo: null,
};

type Ctx = {
  answers: GiftAnswers | null;
  setAnswers: (a: GiftAnswers | null) => void;
  searchId: string | null;
  setSearchId: (id: string | null) => void;
};

const GiftAnswersContext = createContext<Ctx | null>(null);

export function GiftAnswersProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<GiftAnswers | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  return (
    <GiftAnswersContext.Provider value={{ answers, setAnswers, searchId, setSearchId }}>
      {children}
    </GiftAnswersContext.Provider>
  );
}

export function useGiftAnswers() {
  const ctx = useContext(GiftAnswersContext);
  if (!ctx) throw new Error("useGiftAnswers must be used inside GiftAnswersProvider");
  return ctx;
}

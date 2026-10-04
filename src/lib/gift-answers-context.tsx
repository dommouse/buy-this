import { createContext, useContext, useState, type ReactNode } from "react";

export type GiftAnswers = {
  relationship: string;
  relationshipOther: string;
  occasion: string;
  occasionOther: string;
  ageRange: string;
  gender: string;
  vibe: string;
  interests: string[];
  wants: string;
  avoid: string;
  budget: string;
  hasKids: string;
  giftType: string;
  photo: { name: string; type: string; size: number; dataUrl: string } | null;
};

export const emptyAnswers: GiftAnswers = {
  relationship: "",
  relationshipOther: "",
  occasion: "",
  occasionOther: "",
  ageRange: "",
  gender: "",
  vibe: "",
  interests: [],
  wants: "",
  avoid: "",
  budget: "",
  hasKids: "",
  giftType: "",
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

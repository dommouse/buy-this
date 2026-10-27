/** Path ids from the Gift Brain questionnaire spec. */
export type QuestionnairePath = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type QuestionOption = {
  value: string;
  emoji: string;
  hint?: string;
  /** Catalog column / tag this answer maps to (documentation + filter hints). */
  catalog?: string;
};

export type StepKind =
  | "single"
  | "multi"
  | "text"
  | "photo"
  | "pills";

/** Stable step ids used by routing + UI. */
export type StepId =
  | "occasion"
  | "relationship"
  | "age"
  | "budget"
  | "firstBaby"
  | "parentType"
  | "helpWith"
  | "childStage"
  | "childLoves"
  | "familyNeed"
  | "character"
  | "obsessed"
  | "funOrLearning"
  | "teenStyle"
  | "teenInto"
  | "wearUseDo"
  | "photo"
  | "personality"
  | "talkAbout"
  | "feelSeen"
  | "howBig"
  | "professionPride"
  | "howFeel"
  | "practicalOrSpecial"
  | "knowThem"
  | "favorites"
  | "entertain"
  | "homeType"
  | "neverBuy"
  | "graduationLevel";

export type StepDef = {
  id: StepId;
  title: string;
  sub?: string;
  kind: StepKind;
  /** GiftAnswers field this step writes. */
  field: string;
  optional?: boolean;
  maxSelect?: number;
  options?: QuestionOption[];
  placeholder?: string;
  /** Dynamic option filter key resolved in routing. */
  optionsKey?: "age" | "budget" | "relationship" | "familyNeedChild" | "familyNeedOlder";
};

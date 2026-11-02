/**
 * Path routing — priority: Baby Shower → Housewarming → Coworker → age.
 * Order of questions never changes within a path; each answer can change what comes next.
 */
import {
  AGES_ADULT,
  AGES_ALL,
  AGES_CHILD,
  AGES_COWORKER,
  AGES_PARTNER,
  BABY_SHOWER_RELATIONSHIPS,
  BUDGET_FAMILY_OK,
  BUDGETS,
  BUDGETS_COWORKER,
  FAMILY_NEED_OLDER,
  FAMILY_NEED_TODDLER,
  GENDERS_ADULT,
  GENDERS_CHILD,
  GRANDPARENT_OCCASIONS,
  OBSESSED,
  OBSESSED_BOY_HIDDEN,
  PARENT_DAY_RELATIONSHIPS,
  RELATIONSHIPS,
  TEEN_INTO,
  TEEN_INTO_BOY_HIDDEN,
  TEEN_STYLES,
  TEEN_STYLES_BOY_HIDDEN,
  STEPS,
} from "./config";
import type { QuestionOption, QuestionnairePath, StepDef, StepId } from "./types";

export type RouteAnswers = {
  occasion: string;
  relationship: string;
  ageRange: string;
  graduationLevel: string;
  gender?: string;
};

/** Resolve which path (A–G) applies. */
export function resolvePath(a: RouteAnswers): QuestionnairePath {
  const occ = a.occasion;
  if (occ === "Baby Shower") return "A";
  if (occ === "Housewarming") return "G";
  if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") return "F";
  if (a.ageRange === "1-3") return "B";
  if (a.ageRange === "4-9") return "C";
  if (a.ageRange === "10-15" || a.ageRange === "16-19") return "D";
  // Adult kids (Child + 20+) and everyone else → adult Path E
  return "E";
}

/**
 * Mother's / Father's Day now ask Parent vs Grandparent (no longer skip).
 * Kept for backward compat — always false.
 */
export function skipRelationship(_occasion: string): boolean {
  return false;
}

export function autoRelationship(_occasion: string): string | null {
  return null;
}

/** People gifts get a gender step (not Baby Shower / Housewarming). */
export function asksGender(occasion: string): boolean {
  return occasion !== "Baby Shower" && occasion !== "Housewarming";
}

function isBoyOrMan(gender: string): boolean {
  return /^(boy|man|male)$/i.test(gender.trim());
}

function isChildAge(ageRange: string): boolean {
  return ["1-3", "4-9", "10-15", "16-19"].includes(ageRange);
}

function pathTail(path: QuestionnairePath, occasion: string): StepId[] {
  switch (path) {
    case "A":
      return ["firstBaby", "parentType", "helpWith"];
    case "B":
      return ["childStage", "childLoves", "familyNeed", "character"];
    case "C":
      return ["obsessed", "funOrLearning", "familyNeed", "character"];
    case "D":
      // Gender already asked — skip optional photo to stay within 8 steps
      return ["teenStyle", "teenInto", "wearUseDo"];
    case "F":
      return ["knowThem", "favorites"];
    case "G":
      return ["entertain", "homeType", "neverBuy"];
    case "E":
    default: {
      // Gender takes a slot on people paths — keep personality + closer; talkAbout optional via skip
      const base: StepId[] = ["personality", "talkAbout"];
      if (occasion === "Birthday") return [...base, "feelSeen"];
      if (occasion === "Valentine's Day" || occasion === "Anniversary") return [...base, "howBig"];
      if (occasion === "Graduation") return [...base, "professionPride"];
      if (occasion === "Mother's Day" || occasion === "Father's Day") return [...base, "howFeel"];
      // Christmas, Other, etc.
      return [...base, "practicalOrSpecial"];
    }
  }
}

/**
 * Build ordered step list for current answers (max 8).
 * Shared: occasion → relationship → age/grad → gender? → budget → path steps.
 */
export function buildStepIds(a: RouteAnswers): StepId[] {
  const steps: StepId[] = ["occasion"];

  if (!skipRelationship(a.occasion)) {
    steps.push("relationship");
  }

  if (a.occasion === "Baby Shower") {
    // no age / gender
  } else if (a.occasion === "Graduation") {
    steps.push("graduationLevel");
    if (asksGender(a.occasion)) steps.push("gender");
  } else if (a.occasion === "Housewarming") {
    // no age; no gender
  } else {
    steps.push("age");
    if (asksGender(a.occasion) && a.ageRange) steps.push("gender");
  }

  steps.push("budget");

  const path = resolvePath(a);
  if (a.occasion === "Baby Shower" || a.occasion === "Housewarming") {
    steps.push(...pathTail(path, a.occasion));
  } else if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") {
    steps.push(...pathTail("F", a.occasion));
  } else if (a.ageRange || a.graduationLevel) {
    const effective: RouteAnswers = {
      ...a,
      ageRange: a.ageRange || (a.graduationLevel ? "20-39" : a.ageRange),
    };
    steps.push(...pathTail(resolvePath(effective), a.occasion));
  }

  return steps.slice(0, 8);
}

export function getStepDef(id: StepId): StepDef {
  const def = STEPS[id];
  if (!def) throw new Error(`Unknown step ${id}`);
  return def;
}

/** Resolve dynamic option lists for a step given current answers. */
export function optionsForStep(
  id: StepId,
  a: {
    occasion: string;
    relationship: string;
    ageRange: string;
    gender?: string;
  },
): QuestionOption[] {
  const def = getStepDef(id);
  if (def.options && !def.optionsKey) return def.options;

  switch (def.optionsKey) {
    case "relationship": {
      if (a.occasion === "Baby Shower") return BABY_SHOWER_RELATIONSHIPS;
      if (a.occasion === "Mother's Day" || a.occasion === "Father's Day") {
        return PARENT_DAY_RELATIONSHIPS;
      }
      if (GRANDPARENT_OCCASIONS.has(a.occasion)) return RELATIONSHIPS;
      // Valentine's / Anniversary / Graduation / Other — no Grandparent needed
      return RELATIONSHIPS.filter((o) => o.value !== "Grandparent");
    }
    case "age": {
      if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") return AGES_COWORKER;
      if (a.relationship === "Partner") return AGES_PARTNER;
      if (a.relationship === "Child") return AGES_CHILD;
      if (
        a.relationship === "Parent" ||
        a.relationship === "Grandparent" ||
        a.occasion === "Mother's Day" ||
        a.occasion === "Father's Day"
      ) {
        return AGES_ADULT;
      }
      return AGES_ALL;
    }
    case "gender": {
      if (isChildAge(a.ageRange)) return GENDERS_CHILD;
      return GENDERS_ADULT;
    }
    case "budget": {
      if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") {
        return BUDGETS_COWORKER;
      }
      if (BUDGET_FAMILY_OK.has(a.relationship)) return BUDGETS;
      return BUDGETS.filter((o) => o.value !== "$150+");
    }
    case "teenStyle": {
      if (isBoyOrMan(a.gender || "")) {
        return TEEN_STYLES.filter((o) => !TEEN_STYLES_BOY_HIDDEN.has(o.value));
      }
      return TEEN_STYLES;
    }
    case "teenInto": {
      if (isBoyOrMan(a.gender || "")) {
        return TEEN_INTO.filter((o) => !TEEN_INTO_BOY_HIDDEN.has(o.value));
      }
      return TEEN_INTO;
    }
    case "obsessed": {
      if (isBoyOrMan(a.gender || "")) {
        return OBSESSED.filter((o) => !OBSESSED_BOY_HIDDEN.has(o.value));
      }
      return OBSESSED;
    }
    case "familyNeedChild":
      return a.ageRange === "1-3" ? FAMILY_NEED_TODDLER : FAMILY_NEED_OLDER;
    case "familyNeedOlder":
      return FAMILY_NEED_OLDER;
    default:
      return def.options ?? [];
  }
}

export function relationshipTitle(occasion: string): string {
  if (occasion === "Baby Shower") return "How do you know the parents?";
  if (occasion === "Mother's Day") return "Who are you shopping for?";
  if (occasion === "Father's Day") return "Who are you shopping for?";
  return "Who is this for?";
}

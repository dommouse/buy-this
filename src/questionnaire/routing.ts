/**
 * Path routing — priority: Baby Shower → Housewarming → Coworker → age.
 * Order of questions never changes within a path; each answer can change what comes next.
 */
import {
  AGES_ADULT,
  AGES_ALL,
  AGES_CHILD,
  AGES_COWORKER,
  BABY_SHOWER_RELATIONSHIPS,
  BUDGET_FAMILY_OK,
  BUDGETS,
  BUDGETS_COWORKER,
  FAMILY_NEED_OLDER,
  FAMILY_NEED_TODDLER,
  RELATIONSHIPS,
  STEPS,
} from "./config";
import type { QuestionOption, QuestionnairePath, StepDef, StepId } from "./types";

export type RouteAnswers = {
  occasion: string;
  relationship: string;
  ageRange: string;
  graduationLevel: string;
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
  return "E";
}

/** Whether Mother's / Father's Day should auto-set Parent and skip relationship. */
export function skipRelationship(occasion: string): boolean {
  return occasion === "Mother's Day" || occasion === "Father's Day";
}

export function autoRelationship(occasion: string): string | null {
  if (occasion === "Mother's Day" || occasion === "Father's Day") return "Parent";
  return null;
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
      return ["teenStyle", "teenInto", "wearUseDo", "photo"];
    case "F":
      return ["knowThem", "favorites"];
    case "G":
      return ["entertain", "homeType", "neverBuy"];
    case "E":
    default: {
      const base: StepId[] = ["personality", "talkAbout", "photo"];
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
 * Shared: occasion → relationship? → age/grad → budget → path steps.
 */
export function buildStepIds(a: RouteAnswers): StepId[] {
  const steps: StepId[] = ["occasion"];

  if (!skipRelationship(a.occasion)) {
    steps.push("relationship");
  }

  if (a.occasion === "Baby Shower") {
    // no age
  } else if (a.occasion === "Graduation") {
    steps.push("graduationLevel");
  } else {
    steps.push("age");
  }

  steps.push("budget");

  // Path tail needs enough context; use provisional path from what we have.
  const path = resolvePath(a);
  // Housewarming / Baby / Coworker can resolve before age is filled.
  if (a.occasion === "Baby Shower" || a.occasion === "Housewarming") {
    steps.push(...pathTail(path, a.occasion));
  } else if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") {
    steps.push(...pathTail("F", a.occasion));
  } else if (a.ageRange || a.graduationLevel) {
    // Graduation without numeric age → adult path E
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
  },
): QuestionOption[] {
  const def = getStepDef(id);
  if (def.options) return def.options;

  switch (def.optionsKey) {
    case "relationship":
      return a.occasion === "Baby Shower" ? BABY_SHOWER_RELATIONSHIPS : RELATIONSHIPS;
    case "age": {
      if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") return AGES_COWORKER;
      if (a.relationship === "Child") return AGES_CHILD;
      if (
        a.relationship === "Parent" ||
        a.occasion === "Mother's Day" ||
        a.occasion === "Father's Day"
      ) {
        return AGES_ADULT;
      }
      return AGES_ALL;
    }
    case "budget": {
      if (a.relationship === "Coworker or Boss" || a.relationship === "Coworker") {
        return BUDGETS_COWORKER;
      }
      if (BUDGET_FAMILY_OK.has(a.relationship)) return BUDGETS;
      return BUDGETS.filter((o) => o.value !== "$150+");
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
  return "Who is this for?";
}

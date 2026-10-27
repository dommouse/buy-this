/**
 * Questionnaire wording + options — change copy here without touching route code.
 * Every answer is meant to map to a catalog column/tag (see catalog notes on options).
 */
import type { QuestionOption, StepDef } from "./types";

export const OCCASIONS: QuestionOption[] = [
  { value: "Christmas", emoji: "🎄", catalog: "Column B Occasion" },
  { value: "Birthday", emoji: "🎂", catalog: "Column B Occasion" },
  { value: "Baby Shower", emoji: "🍼", catalog: "Column B Occasion" },
  { value: "Housewarming", emoji: "🏡", catalog: "Column B Occasion" },
  { value: "Valentine's Day", emoji: "💘", catalog: "Column B Occasion" },
  { value: "Anniversary", emoji: "💍", catalog: "Column B Occasion" },
  { value: "Graduation", emoji: "🎓", catalog: "Column B Occasion" },
  { value: "Mother's Day", emoji: "🌷", catalog: "Column B Occasion" },
  { value: "Father's Day", emoji: "👔", catalog: "Column B Occasion" },
  { value: "Other", emoji: "✨", catalog: "Column B Occasion" },
];

export const RELATIONSHIPS: QuestionOption[] = [
  { value: "Partner", emoji: "💕", catalog: "Column H Relationship" },
  { value: "Parent", emoji: "👨‍👧", catalog: "Column H Relationship" },
  { value: "Child", emoji: "🧒", catalog: "Column H Relationship" },
  { value: "Friend", emoji: "🤝", catalog: "Column H Relationship" },
  { value: "Coworker or Boss", emoji: "💼", catalog: "Column H Relationship" },
  { value: "Other family member", emoji: "🎁", catalog: "Column H Relationship" },
];

export const BABY_SHOWER_RELATIONSHIPS: QuestionOption[] = [
  { value: "Friend", emoji: "🤝", catalog: "Column H Relationship" },
  { value: "Family", emoji: "👨‍👧", catalog: "Column H Relationship" },
  { value: "Coworker", emoji: "💼", catalog: "Column H Relationship" },
];

export const AGES_ALL: QuestionOption[] = [
  { value: "1-3", emoji: "👶", catalog: "age batch" },
  { value: "4-9", emoji: "🧸", catalog: "age batch" },
  { value: "10-15", emoji: "🎧", catalog: "age batch" },
  { value: "16-19", emoji: "📱", catalog: "age batch" },
  { value: "20-39", emoji: "✨", catalog: "age batch" },
  { value: "40+", emoji: "🏆", catalog: "age batch" },
];

export const AGES_CHILD: QuestionOption[] = AGES_ALL.filter((o) =>
  ["1-3", "4-9", "10-15", "16-19"].includes(o.value),
);
export const AGES_ADULT: QuestionOption[] = AGES_ALL.filter((o) =>
  ["20-39", "40+"].includes(o.value),
);
export const AGES_COWORKER: QuestionOption[] = AGES_ADULT;

export const GRADUATION_LEVELS: QuestionOption[] = [
  { value: "High school", emoji: "🎒", catalog: "Graduation HS" },
  { value: "College", emoji: "🎓", catalog: "Graduation College" },
];

export const BUDGETS: QuestionOption[] = [
  { value: "Under $25", emoji: "🪙", hint: "Price tier $", catalog: "Column G $" },
  { value: "$25-60", emoji: "💵", hint: "Price tier $$", catalog: "Column G $$" },
  { value: "$60-150", emoji: "💸", hint: "Price tier $$$", catalog: "Column G $$$" },
  { value: "$150+", emoji: "💎", hint: "Price tier $$$$", catalog: "Column G $$$$" },
];

export const BUDGETS_COWORKER: QuestionOption[] = BUDGETS.filter((o) =>
  ["Under $25", "$25-60"].includes(o.value),
);

/** Relationships that may see $150+ (Rule 17). */
export const BUDGET_FAMILY_OK = new Set(["Child", "Parent", "Other family member", "Partner", "Family"]);

export const FIRST_BABY: QuestionOption[] = [
  { value: "First baby", emoji: "⭐" },
  { value: "Not the first baby", emoji: "🌟" },
];

export const PARENT_TYPES: QuestionOption[] = [
  { value: "Always on the go", emoji: "🏃", catalog: "Column I On The Go" },
  { value: "Safety-first and top-rated", emoji: "🩹", catalog: "Column I Safety-First" },
  { value: "Minimalist", emoji: "💛", catalog: "Column I Minimalist" },
  { value: "Tech-savvy", emoji: "📱", catalog: "Column I Tech-Savvy" },
  { value: "Creative and sentimental", emoji: "🎨", catalog: "Column I Creative/Keepsake" },
];

export const HELP_WITH: QuestionOption[] = [
  { value: "Sleep", emoji: "🛋️", catalog: "Column C Safe Sleep" },
  { value: "Feeding", emoji: "🍼", catalog: "Column C Feeding" },
  { value: "Bath time", emoji: "🍼", catalog: "Column C Bath Time" },
  { value: "Getting around", emoji: "🏎️", catalog: "Column C On The Go" },
  { value: "Nursery", emoji: "🏡", catalog: "Column C Nursery" },
  { value: "Play", emoji: "🧸", catalog: "Column C Play" },
  { value: "Postpartum and mom care", emoji: "💝", catalog: "Column C Postpartum" },
];

export const CHILD_STAGES: QuestionOption[] = [
  { value: "Baby and crawling", emoji: "👶" },
  { value: "Walking", emoji: "🏃" },
  { value: "Talking and exploring", emoji: "🎧" },
];

export const CHILD_LOVES: QuestionOption[] = [
  { value: "Music", emoji: "🎵", catalog: "Column C" },
  { value: "Animals", emoji: "🐾", catalog: "Column C" },
  { value: "Vehicles", emoji: "🏎️", catalog: "Column C" },
  { value: "Books", emoji: "📚", catalog: "Column C" },
  { value: "Sensory play", emoji: "🤝", catalog: "Column C" },
  { value: "Outdoors", emoji: "🌿", catalog: "Column C" },
];

export const FAMILY_NEED_TODDLER: QuestionOption[] = [
  { value: "Clothes", emoji: "👔", catalog: "Rule 1 double duty" },
  { value: "Bath time", emoji: "🍼", catalog: "Rule 1" },
  { value: "Feeding", emoji: "🍳", catalog: "Rule 1" },
  { value: "Travel gear", emoji: "🎒", catalog: "Rule 1" },
  { value: "Nothing, just fun", emoji: "🎉", catalog: "Rule 1" },
];

export const FAMILY_NEED_OLDER: QuestionOption[] = [
  { value: "Clothes", emoji: "👔", catalog: "Rule 1" },
  { value: "Gear for their hobby", emoji: "🏆", catalog: "Rule 1" },
  { value: "Travel gear", emoji: "🎒", catalog: "Rule 1" },
  { value: "Nothing, just fun", emoji: "🎉", catalog: "Rule 1" },
];

export const OBSESSED: QuestionOption[] = [
  { value: "Animals", emoji: "🐾", catalog: "Column C" },
  { value: "Art and crafts", emoji: "🎨", catalog: "Column C" },
  { value: "Sports", emoji: "🏃", catalog: "Column C" },
  { value: "Dinosaurs and science", emoji: "🧸", catalog: "Column C" },
  { value: "Princesses and dress up", emoji: "👑", catalog: "Column C" },
  { value: "Superheroes", emoji: "⭐", catalog: "Column C" },
  { value: "Building and LEGO", emoji: "🎨", catalog: "Column C" },
  { value: "Music", emoji: "🎵", catalog: "Column C" },
  { value: "Vehicles", emoji: "🏎️", catalog: "Column C" },
  { value: "Books", emoji: "📚", catalog: "Column C" },
  { value: "Outdoors", emoji: "🌿", catalog: "Column C" },
  { value: "Games and puzzles", emoji: "🎮", catalog: "Column C" },
];

export const FUN_OR_LEARNING: QuestionOption[] = [
  { value: "Pure fun", emoji: "🎉" },
  { value: "A mix", emoji: "✨" },
  { value: "More educational", emoji: "📚", catalog: "Rule 11" },
];

export const TEEN_STYLES: QuestionOption[] = [
  { value: "Sporty", emoji: "🏃" },
  { value: "Girly", emoji: "💕" },
  { value: "Trendy and streetwear", emoji: "💅" },
  { value: "Cozy and casual", emoji: "🛋️" },
  { value: "Preppy", emoji: "👔" },
  { value: "Edgy", emoji: "✨" },
];

export const TEEN_INTO: QuestionOption[] = [
  { value: "Fashion", emoji: "💄", catalog: "Column C" },
  { value: "Beauty and hair", emoji: "💄", catalog: "Column C" },
  { value: "Tech", emoji: "📱", catalog: "Column C" },
  { value: "Sports", emoji: "🏃", catalog: "Column C" },
  { value: "Music", emoji: "🎵", catalog: "Column C" },
  { value: "Art and creating", emoji: "🎨", catalog: "Column C" },
  { value: "Gaming", emoji: "🎮", catalog: "Column C" },
  { value: "Travel", emoji: "✈️", catalog: "Column C" },
];

export const WEAR_USE_DO: QuestionOption[] = [
  { value: "Something to wear", emoji: "👔", catalog: "wear_use_do=wear" },
  { value: "Something to use", emoji: "💼", catalog: "wear_use_do=use" },
  { value: "An experience", emoji: "🎟️", catalog: "wear_use_do=do" },
];

/** Adult Path E — “What are they like?” (pick up to 2). Catalog Column I. */
export const PERSONALITIES: QuestionOption[] = [
  { value: "Creative", emoji: "🎨", catalog: "Column I" },
  { value: "Active", emoji: "🏃", catalog: "Column I" },
  { value: "Minimalist", emoji: "💛", catalog: "Column I" },
  { value: "Tech-savvy", emoji: "📱", catalog: "Column I" },
  { value: "Sentimental", emoji: "💝", catalog: "Column I" },
  { value: "Trendy and fashion-forward", emoji: "💅", catalog: "Column I" },
  { value: "Loves to read", emoji: "📚", catalog: "Column I Reading" },
  { value: "Homebody", emoji: "🛋️", catalog: "Column I" },
  { value: "Outdoorsy", emoji: "🌿", catalog: "Column I" },
  { value: "Foodie", emoji: "🍳", catalog: "Column I" },
  { value: "Music lover", emoji: "🎵", catalog: "Column I" },
  { value: "Gamer", emoji: "🎮", catalog: "Column I" },
  { value: "Wellness-focused", emoji: "🧘", catalog: "Column I" },
  { value: "Career-driven", emoji: "💼", catalog: "Column I" },
  { value: "Funny and witty", emoji: "✨", catalog: "Column I" },
  { value: "Romantic", emoji: "💕", catalog: "Column I" },
  { value: "Spiritual or mindful", emoji: "🕊️", catalog: "Column I" },
  { value: "Pet parent", emoji: "🐾", catalog: "Column I" },
  { value: "DIY and maker", emoji: "✂️", catalog: "Column I" },
  { value: "Luxury-oriented", emoji: "💎", catalog: "Column I" },
  { value: "Practical", emoji: "🎯", catalog: "Column I" },
  { value: "Social butterfly", emoji: "🎉", catalog: "Column I" },
  { value: "Intellectual", emoji: "📚", catalog: "Column I" },
  { value: "Eco-conscious", emoji: "🌱", catalog: "Column I" },
  { value: "Nostalgic", emoji: "⭐", catalog: "Column I" },
  { value: "Sports fan", emoji: "🏆", catalog: "Column I" },
  { value: "Traveler", emoji: "✈️", catalog: "Column I" },
  { value: "Gardener", emoji: "🌻", catalog: "Column I" },
  { value: "Movie and TV buff", emoji: "🎬", catalog: "Column I" },
  { value: "Wine and cocktails", emoji: "🍹", catalog: "Column I" },
];

export const PRACTICAL_OR_SPECIAL: QuestionOption[] = [
  { value: "Something useful", emoji: "💼" },
  { value: "Something special", emoji: "✨" },
  { value: "Go all out", emoji: "🚀" },
];

export const FEEL_SEEN: QuestionOption[] = [
  { value: "Something they always talk about wanting", emoji: "✨" },
  { value: "Something that shows I really know them", emoji: "💛" },
  { value: "A treat they wouldn't buy themselves", emoji: "🎁" },
];

export const HOW_BIG: QuestionOption[] = [
  { value: "Sweet and simple", emoji: "💝" },
  { value: "Go all out", emoji: "💎" },
];

export const PROFESSION_PRIDE: QuestionOption[] = [
  { value: "Nurse", emoji: "🩹" },
  { value: "Teacher", emoji: "🌻" },
  { value: "Business", emoji: "💼" },
  { value: "Other/None", emoji: "🤷" },
];

export const HOW_FEEL: QuestionOption[] = [
  { value: "Appreciated", emoji: "🙏" },
  { value: "Pampered", emoji: "🧘" },
  { value: "Make a memory", emoji: "📸" },
];

export const KNOW_THEM: QuestionOption[] = [
  { value: "Not well", emoji: "🤷" },
  { value: "Somewhat", emoji: "😊" },
  { value: "Pretty well", emoji: "😊" },
];

export const FAVORITES: QuestionOption[] = [
  { value: "Coffee person", emoji: "🏠" },
  { value: "Has a favorite team", emoji: "🏆" },
  { value: "Neither", emoji: "🙅" },
];

export const ENTERTAIN: QuestionOption[] = [
  { value: "Often", emoji: "🎉" },
  { value: "Sometimes", emoji: "😊" },
  { value: "Rarely", emoji: "🛋️" },
];

export const HOME_TYPE: QuestionOption[] = [
  { value: "House", emoji: "🏠" },
  { value: "Apartment", emoji: "🏡" },
  { value: "Small space", emoji: "🎁" },
];

export const NEVER_BUY: QuestionOption[] = [
  { value: "Fun entertaining gadgets", emoji: "🎉", catalog: "Housewarming OK kitchen" },
  { value: "Games", emoji: "🎮" },
  { value: "Drink and bar items", emoji: "🍹" },
];

/** Static step definitions keyed by id (titles/copy editable here). */
export const STEPS: Record<string, StepDef> = {
  occasion: {
    id: "occasion",
    title: "What's the occasion?",
    kind: "single",
    field: "occasion",
    options: OCCASIONS,
  },
  relationship: {
    id: "relationship",
    title: "Who is this for?",
    kind: "single",
    field: "relationship",
    optionsKey: "relationship",
  },
  age: {
    id: "age",
    title: "How old are they?",
    kind: "pills",
    field: "ageRange",
    optionsKey: "age",
  },
  graduationLevel: {
    id: "graduationLevel",
    title: "High school or college?",
    kind: "pills",
    field: "graduationLevel",
    options: GRADUATION_LEVELS,
  },
  budget: {
    id: "budget",
    title: "What's your budget?",
    kind: "single",
    field: "budget",
    optionsKey: "budget",
  },
  firstBaby: {
    id: "firstBaby",
    title: "Is this their first baby?",
    kind: "pills",
    field: "firstBaby",
    options: FIRST_BABY,
  },
  parentType: {
    id: "parentType",
    title: "What are the parents like?",
    sub: "Pick 1",
    kind: "single",
    field: "parentType",
    options: PARENT_TYPES,
  },
  helpWith: {
    id: "helpWith",
    title: "What do you want to help with?",
    sub: "Pick 1",
    kind: "single",
    field: "helpWith",
    options: HELP_WITH,
  },
  childStage: {
    id: "childStage",
    title: "What stage are they in?",
    kind: "pills",
    field: "childStage",
    options: CHILD_STAGES,
  },
  childLoves: {
    id: "childLoves",
    title: "What do they love right now?",
    sub: "Pick up to 2",
    kind: "multi",
    field: "interests",
    maxSelect: 2,
    options: CHILD_LOVES,
  },
  familyNeed: {
    id: "familyNeed",
    title: "What does the family need right now?",
    sub: "Pick 1",
    kind: "single",
    field: "familyNeed",
    optionsKey: "familyNeedChild",
  },
  character: {
    id: "character",
    title: "Favorite character?",
    sub: "Optional — skip if you're not sure",
    kind: "text",
    field: "character",
    optional: true,
    placeholder: "e.g. Bluey, Spider-Man, Elsa",
  },
  obsessed: {
    id: "obsessed",
    title: "What are they obsessed with?",
    sub: "Pick up to 2",
    kind: "multi",
    field: "interests",
    maxSelect: 2,
    options: OBSESSED,
  },
  funOrLearning: {
    id: "funOrLearning",
    title: "Fun or learning?",
    kind: "pills",
    field: "funOrLearning",
    options: FUN_OR_LEARNING,
  },
  teenStyle: {
    id: "teenStyle",
    title: "What's their style?",
    kind: "single",
    field: "teenStyle",
    options: TEEN_STYLES,
  },
  teenInto: {
    id: "teenInto",
    title: "What are they into right now?",
    sub: "Pick up to 2",
    kind: "multi",
    field: "interests",
    maxSelect: 2,
    options: TEEN_INTO,
  },
  wearUseDo: {
    id: "wearUseDo",
    title: "Wear it, use it, or do it?",
    kind: "pills",
    field: "wearUseDo",
    options: WEAR_USE_DO,
  },
  photo: {
    id: "photo",
    title: "Upload a photo of them",
    sub: "Optional — helps read their style. Skip if you prefer.",
    kind: "photo",
    field: "photo",
    optional: true,
  },
  personality: {
    id: "personality",
    title: "What are they like?",
    sub: "Pick 1 or 2",
    kind: "multi",
    field: "personality",
    maxSelect: 2,
    options: PERSONALITIES,
  },
  talkAbout: {
    id: "talkAbout",
    title: "What do they always talk about?",
    sub: "Optional — one line of context",
    kind: "text",
    field: "talkAbout",
    optional: true,
    placeholder: "e.g. hiking trips, their dog, learning pottery",
  },
  practicalOrSpecial: {
    id: "practicalOrSpecial",
    title: "Practical or special?",
    kind: "pills",
    field: "practicalOrSpecial",
    options: PRACTICAL_OR_SPECIAL,
  },
  feelSeen: {
    id: "feelSeen",
    title: "What would make them feel seen?",
    kind: "single",
    field: "feelSeen",
    options: FEEL_SEEN,
  },
  howBig: {
    id: "howBig",
    title: "How big?",
    kind: "pills",
    field: "howBig",
    options: HOW_BIG,
  },
  professionPride: {
    id: "professionPride",
    title: "Do they have a profession or school pride?",
    kind: "pills",
    field: "professionPride",
    options: PROFESSION_PRIDE,
  },
  howFeel: {
    id: "howFeel",
    title: "How do you want them to feel?",
    kind: "pills",
    field: "howFeel",
    options: HOW_FEEL,
  },
  knowThem: {
    id: "knowThem",
    title: "How well do you know them?",
    kind: "pills",
    field: "knowThem",
    options: KNOW_THEM,
  },
  favorites: {
    id: "favorites",
    title: "Any favorites?",
    kind: "pills",
    field: "favorites",
    options: FAVORITES,
  },
  entertain: {
    id: "entertain",
    title: "Do they entertain?",
    kind: "pills",
    field: "entertain",
    options: ENTERTAIN,
  },
  homeType: {
    id: "homeType",
    title: "What's their home type?",
    kind: "pills",
    field: "homeType",
    options: HOME_TYPE,
  },
  neverBuy: {
    id: "neverBuy",
    title: "What would they never buy themselves?",
    kind: "single",
    field: "neverBuy",
    options: NEVER_BUY,
  },
};

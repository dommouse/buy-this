import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Home, ImagePlus, X } from "lucide-react";

import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { emptyAnswers, useGiftAnswers, type GiftAnswers } from "@/lib/gift-answers-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/questionnaire")({
  head: () => ({
    meta: [
      { title: "Gift Questionnaire — BUY THIS" },
      { name: "description", content: "Answer a few fun questions and BUY THIS finds the perfect gift." },
      { property: "og:title", content: "Gift Questionnaire — BUY THIS" },
      { property: "og:description", content: "Answer a few fun questions and BUY THIS finds the perfect gift." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionnairePage,
});

type Option = { value: string; emoji: string; hint?: string };

const relationships: Option[] = [
  { value: "Partner", emoji: "💕" },
  { value: "Mom", emoji: "👩‍👧" },
  { value: "Dad", emoji: "👨‍👧" },
  { value: "Friend", emoji: "🤝" },
  { value: "Sibling", emoji: "👫" },
  { value: "Child", emoji: "🧒" },
  { value: "Coworker/Boss", emoji: "💼" },
  { value: "Grandparent", emoji: "🧓" },
  { value: "Other", emoji: "🎁" },
];
const occasions: Option[] = [
  { value: "Birthday", emoji: "🎂" },
  { value: "Christmas/Holiday", emoji: "🎄" },
  { value: "Valentine's Day", emoji: "💘" },
  { value: "Anniversary", emoji: "💍" },
  { value: "Mother's Day", emoji: "🌷" },
  { value: "Father's Day", emoji: "👔" },
  { value: "Graduation", emoji: "🎓" },
  { value: "Baby Shower", emoji: "🍼" },
  { value: "Wedding", emoji: "💒" },
  { value: "Housewarming", emoji: "🏡" },
  { value: "Just Because", emoji: "💝" },
  { value: "Thank You", emoji: "🙏" },
  { value: "Get Well", emoji: "🩹" },
  { value: "Sympathy", emoji: "🕊️" },
  { value: "Other", emoji: "✨" },
];
const childAges: Option[] = [
  { value: "Under 1", emoji: "🍼" }, { value: "1-2", emoji: "👶" },
  { value: "3-5", emoji: "🧸" }, { value: "6-8", emoji: "🛝" },
  { value: "9-10", emoji: "🎒" }, { value: "11-12", emoji: "⭐" },
];
const teenAges: Option[] = [
  { value: "13-15", emoji: "🎧" }, { value: "16-19", emoji: "📱" },
];
const adultAges: Option[] = [
  { value: "18-20", emoji: "🎓" }, { value: "21-25", emoji: "✨" },
  { value: "26-30", emoji: "🌟" }, { value: "31-40", emoji: "🌱" },
  { value: "41-50", emoji: "🏆" }, { value: "51-64", emoji: "🌻" },
  { value: "65+", emoji: "💛" },
];
const genders: Option[] = [
  { value: "Male", emoji: "👨" }, { value: "Female", emoji: "👩" },
  { value: "Non-binary", emoji: "🌈" }, { value: "Prefer not to say", emoji: "😊" },
];
const vibes: Option[] = [
  { value: "Homebody", emoji: "🏠", hint: "cozy, indoors, relaxed" },
  { value: "Outdoorsy", emoji: "🌿", hint: "nature, adventure, active" },
  { value: "Creative", emoji: "🎨", hint: "artsy, crafty, expressive" },
  { value: "Hustler", emoji: "💼", hint: "ambitious, career-driven, busy" },
  { value: "Social Butterfly", emoji: "🎉", hint: "loves people, parties, events" },
  { value: "Intellectual", emoji: "📚", hint: "reads, learns, deep thinker" },
  { value: "Trendsetter", emoji: "💅", hint: "fashion-forward, on top of trends" },
  { value: "Wellness-focused", emoji: "🧘", hint: "health, fitness, mindfulness" },
];
const interests: Option[] = [
  { value: "Cooking/Food", emoji: "🍳" }, { value: "Sports/Fitness", emoji: "🏃" },
  { value: "Music", emoji: "🎵" }, { value: "Gaming", emoji: "🎮" },
  { value: "Reading", emoji: "📚" }, { value: "Travel", emoji: "✈️" },
  { value: "Fashion/Beauty", emoji: "💄" }, { value: "Tech/Gadgets", emoji: "📱" },
  { value: "Art/Design", emoji: "🎨" }, { value: "Gardening", emoji: "🌱" },
  { value: "DIY/Crafts", emoji: "✂️" }, { value: "Pets/Animals", emoji: "🐾" },
  { value: "Movies/TV", emoji: "🎬" }, { value: "Cars/Motorsports", emoji: "🏎️" },
  { value: "Home Decor", emoji: "🛋️" }, { value: "Spirituality/Faith", emoji: "🕊️" },
  { value: "Photography", emoji: "📸" }, { value: "Wine/Cocktails", emoji: "🍹" },
  { value: "I don't really know 🤷", emoji: "🤷" },
];
const unknownInterest = "I don't really know 🤷";
const budgets: Option[] = [
  { value: "Under $25", emoji: "🪙", hint: "Thoughtful & Thrifty" },
  { value: "$25-$50", emoji: "💵", hint: "Sweet Spot" },
  { value: "$50-$100", emoji: "💸", hint: "Go-Getter" },
  { value: "$100-$200", emoji: "💰", hint: "Big Impression" },
  { value: "$200-$350", emoji: "🚀", hint: "All Out" },
  { value: "$350-$500", emoji: "💎", hint: "Luxury" },
  { value: "$500+", emoji: "👑", hint: "Sky's the Limit" },
];
const giftTypes: Option[] = [
  { value: "Something to Unwrap", emoji: "🎁", hint: "a physical product they can hold" },
  { value: "An Experience", emoji: "🎟️", hint: "tickets, classes, adventures" },
  { value: "A Gift Card or Cash", emoji: "💳", hint: "let them choose" },
  { value: "Surprise Me", emoji: "🤷", hint: "let the Gift Brain decide" },
];
const kidsHiddenFor = ["Child"];
const childRelationships = ["Child"];

type StepId =
  | "relationship" | "occasion" | "age" | "gender" | "vibe" | "interests"
  | "wants" | "avoid" | "budget" | "kids" | "giftType" | "photo";

const MAX_PHOTO = 5 * 1024 * 1024;
const emojiAssets = import.meta.glob<string>("../assets/emoji/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

function EmojiIcon({ emoji }: { emoji: string }) {
  const codePoint = [...emoji]
    .map((character) => character.codePointAt(0)?.toString(16))
    .filter((code) => code && code !== "fe0f")
    .join("-");
  const src = emojiAssets[`../assets/emoji/${codePoint}.svg`];

  if (!src) return <span className="size-6 shrink-0" aria-hidden="true" />;
  return <img src={src} alt="" aria-hidden="true" className="size-6 shrink-0 object-contain" />;
}

function QuestionnairePage() {
  const navigate = useNavigate();
  const { setAnswers: saveAnswers } = useGiftAnswers();
  const [a, setA] = useState<GiftAnswers>(emptyAnswers);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  const steps = useMemo<StepId[]>(() => {
    const all: StepId[] = ["relationship", "occasion", "age", "gender", "vibe", "interests", "wants", "avoid", "budget", "kids", "giftType", "photo"];
    return kidsHiddenFor.includes(a.relationship) ? all.filter((s) => s !== "kids") : all;
  }, [a.relationship]);

  const step = steps[Math.min(index, steps.length - 1)] ?? "relationship";
  const isLast = index === steps.length - 1;
  const progress = ((index + 1) / steps.length) * 100;

  const update = <K extends keyof GiftAnswers>(key: K, value: GiftAnswers[K]) => {
    setA((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const validate = (): string => {
    switch (step) {
      case "relationship":
        if (!a.relationship) return "Pick one to continue";
        if (a.relationship === "Other" && !a.relationshipOther.trim()) return "Tell me who it's for";
        return "";
      case "occasion":
        if (!a.occasion) return "Pick one to continue";
        if (a.occasion === "Other" && !a.occasionOther.trim()) return "Tell me the occasion";
        return "";
      case "age": return a.ageRange ? "" : "Pick one to continue";
      case "gender": return a.gender ? "" : "Pick one to continue";
      case "vibe": return a.vibe ? "" : "Pick one to continue";
      case "interests": return a.interests.length ? "" : "Pick at least one to continue";
      case "budget": return a.budget ? "" : "Pick one to continue";
      case "kids": return a.hasKids ? "" : "Pick one to continue";
      case "giftType": return a.giftType ? "" : "Pick one to continue";
      default: return "";
    }
  };

  const finish = () => {
    const final = { ...a, hasKids: kidsHiddenFor.includes(a.relationship) ? "" : a.hasKids };
    console.log("BUY THIS answers:", final);
    saveAnswers(final);
    navigate({ to: "/results" });
  };

  const next = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      setShakeKey((k) => k + 1);
      return;
    }
    if (isLast) return finish();
    setDirection(1);
    setIndex((i) => i + 1);
  };

  const skip = () => {
    setError("");
    setDirection(1);
    setIndex((i) => i + 1);
  };

  const back = () => {
    if (index === 0) return;
    setError("");
    setDirection(-1);
    setIndex((i) => i - 1);
  };

  return (
    <main className="min-h-dvh bg-background px-4 pb-8 pt-20 text-foreground sm:pt-24">
      <AppMenu />
      <div className="mx-auto w-full max-w-2xl">
        <Button asChild variant="ghost" className="mb-3 min-h-11 gap-2 px-2 text-muted-foreground hover:text-primary">
          <Link to="/">
            <Home className="size-4" aria-hidden="true" />
            Home
          </Link>
        </Button>
        <div className="rounded-2xl bg-card shadow-[0_8px_30px_-12px_oklch(0.4_0.1_350/0.25)]">
          <div className="sticky top-0 z-10 rounded-t-2xl bg-card px-5 pb-3 pt-5 sm:px-8">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Question {index + 1} of {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div
            key={`${step}-${index}`}
            className="animate-question-in px-5 pb-6 pt-4 sm:px-8"
            style={{ ["--q-from" as string]: direction === 1 ? "24px" : "-24px" }}
          >
            <div key={shakeKey} className={cn(shakeKey > 0 && error && "animate-gentle-shake")}>
              <StepBody step={step} a={a} update={update} onSkip={skip} onFinish={finish} />
              <p className={cn("mt-4 min-h-5 text-sm text-destructive transition-opacity", error ? "opacity-100" : "opacity-0")} role="alert">
                {error}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-card px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={back}
              disabled={index === 0}
              className="min-h-11 px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:invisible"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={next}
              className={cn(
                "min-h-11 rounded-full bg-primary font-bold text-primary-foreground shadow-sm transition-all hover:scale-[1.03] hover:bg-primary/90 active:scale-95",
                isLast ? "px-8 py-3.5 text-base sm:text-lg" : "px-7 py-3 text-sm",
              )}
            >
              {isLast ? (a.photo ? "Find My Gifts 🎁" : "Skip — Find My Gifts 🎁") : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

type BodyProps = {
  step: StepId;
  a: GiftAnswers;
  update: <K extends keyof GiftAnswers>(key: K, value: GiftAnswers[K]) => void;
  onSkip: () => void;
  onFinish: () => void;
};

function StepBody({ step, a, update, onSkip }: BodyProps) {
  switch (step) {
    case "relationship":
      return (
        <>
          <Heading title="Who are you shopping for?" />
          <CardGrid
            options={relationships}
            value={a.relationship}
            onChange={(v) => {
              if (v !== a.relationship) update("ageRange", "");
              update("relationship", v);
            }}
          />
          {a.relationship === "Other" && (
            <TextField autoFocus value={a.relationshipOther} onChange={(v) => update("relationshipOther", v)} placeholder="Who is it for?" />
          )}
        </>
      );
    case "occasion":
      return (
        <>
          <Heading title="What's the occasion?" />
          <CardGrid options={occasions} value={a.occasion} onChange={(v) => update("occasion", v)} />
          {a.occasion === "Other" && (
            <TextField autoFocus value={a.occasionOther} onChange={(v) => update("occasionOther", v)} placeholder="What's the occasion?" />
          )}
        </>
      );
    case "age": {
      // Child covers kids + teens (13–19). There is no separate "Teen" relationship option.
      const ageOptions = childRelationships.includes(a.relationship)
        ? [...childAges, ...teenAges]
        : adultAges;
      return (
        <>
          <Heading title="How old are they?" />
          <Pills options={ageOptions} value={a.ageRange} onChange={(v) => update("ageRange", v)} />
        </>
      );
    }
    case "gender":
      return (
        <>
          <Heading title="What gender do they identify as?" />
          <Pills options={genders} value={a.gender} onChange={(v) => update("gender", v)} />
        </>
      );
    case "vibe":
      return (
        <>
          <Heading title="What's their vibe?" sub="Pick the one that fits them best" />
          <CardGrid options={vibes} value={a.vibe} onChange={(v) => update("vibe", v)} cols="grid-cols-1 sm:grid-cols-2" row />
        </>
      );
    case "interests": {
      const toggle = (v: string) => {
        if (a.interests.includes(v)) {
          update("interests", a.interests.filter((i) => i !== v));
        } else if (v === unknownInterest) {
          update("interests", [unknownInterest]);
        } else {
          const knownInterests = a.interests.filter((i) => i !== unknownInterest);
          if (knownInterests.length < 3) update("interests", [...knownInterests, v]);
        }
      };
      return (
        <>
          <Heading title="What are they into? Pick up to 3." />
          <p className="mb-3 text-sm font-medium text-primary">{a.interests.length}/3 selected</p>
          <div className="flex flex-wrap gap-2">
            {interests.map((option) => {
              const on = a.interests.includes(option.value);
              const isUnknown = option.value === unknownInterest;
              const knownCount = a.interests.filter((i) => i !== unknownInterest).length;
              const disabled = !isUnknown && !on && knownCount >= 3;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all",
                    isUnknown && !on && "border-dashed bg-muted/60",
                    on && !isUnknown ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60",
                    on && isUnknown && "border-primary bg-accent text-accent-foreground",
                    disabled && "opacity-40",
                  )}
                >
                  {on && <Check className="size-4" strokeWidth={3} />}
                  <EmojiIcon emoji={option.emoji} />
                  {option.value}
                </button>
              );
            })}
          </div>
        </>
      );
    }
    case "wants":
      return (
        <>
          <Heading title="Is there anything they've mentioned wanting?" sub="Even a hint helps! If nothing comes to mind, skip this one." />
          <TextField value={a.wants} onChange={(v) => update("wants", v)} placeholder="e.g., 'a nice watch', 'cooking gadgets', 'something for their home office'" />
          <SkipLink onClick={onSkip} />
        </>
      );
    case "avoid":
      return (
        <>
          <Heading title="Anything I should definitely NOT suggest?" sub="Things they already have, dislike, or would be awkward to give." />
          <TextField value={a.avoid} onChange={(v) => update("avoid", v)} placeholder="e.g., 'no candles', 'they already have an Apple Watch', 'nothing too personal'" />
          <SkipLink onClick={onSkip} />
        </>
      );
    case "budget":
      return (
        <>
          <Heading title="What's your budget?" />
          <CardGrid options={budgets} value={a.budget} onChange={(v) => update("budget", v)} cols="grid-cols-2 sm:grid-cols-3" big />
        </>
      );
    case "kids":
      return (
        <>
          <Heading title="Do they have kids?" sub="This helps me pick gifts that are practical for their life." />
          <Pills
            options={[{ value: "Yes", emoji: "👶" }, { value: "No", emoji: "🙅" }, { value: "Not sure", emoji: "🤔" }]}
            value={a.hasKids}
            onChange={(v) => update("hasKids", v)}
          />
        </>
      );
    case "giftType":
      return (
        <>
          <Heading title="What kind of gift feels right?" />
          <CardGrid options={giftTypes} value={a.giftType} onChange={(v) => update("giftType", v)} cols="grid-cols-1 sm:grid-cols-2" row />
        </>
      );
    case "photo":
      return (
        <>
          <Heading title="Got a photo of them?" sub="Upload a photo and I'll pick up on their style, vibe, and aesthetic. Totally optional but it helps me nail it! 📸" />
          <PhotoUpload photo={a.photo} onChange={(p) => update("photo", p)} />
        </>
      );
  }
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{sub}</p>}
    </div>
  );
}

function CardGrid({
  options, value, onChange, cols = "grid-cols-2 sm:grid-cols-3", row, big,
}: { options: Option[]; value: string; onChange: (v: string) => void; cols?: string; row?: boolean; big?: boolean }) {
  return (
    <div className={cn("grid gap-3", cols)} role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex min-h-11 rounded-xl border-2 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 active:scale-[0.98]",
              row ? "items-center gap-3 text-left" : "flex-col items-center justify-center gap-1.5 text-center",
              on ? "border-primary bg-accent shadow-sm" : "border-border bg-card",
            )}
          >
            <EmojiIcon emoji={o.emoji} />
            <span className="min-w-0">
              <span className={cn("block font-semibold", big ? "text-lg" : "text-sm")}>{o.value}</span>
              {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
            </span>
            {on && (
              <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-all active:scale-95",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60",
            )}
          >
            <EmojiIcon emoji={o.emoji} />
            {o.value}
          </button>
        );
      })}
    </div>
  );
}

function TextField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <input
      type="text"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-3 h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30"
    />
  );
}

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 min-h-11 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
      Skip this one
    </button>
  );
}

function PhotoUpload({ photo, onChange }: { photo: GiftAnswers["photo"]; onChange: (p: GiftAnswers["photo"]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");

  const handle = (file?: File) => {
    if (!file) return;
    const okType = /image\/(jpeg|png|heic|heif)/.test(file.type) || /\.(jpe?g|png|heic)$/i.test(file.name);
    if (!okType) return setErr("Please upload a JPG, PNG, or HEIC image.");
    if (file.size > MAX_PHOTO) return setErr("That photo is over 5MB — try a smaller one.");
    setErr("");
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  if (photo) {
    const isHeic = /heic|heif/i.test(photo.type) || /\.heic$/i.test(photo.name);
    return (
      <div className="relative mx-auto w-fit">
        {isHeic ? (
          <div className="grid size-48 place-items-center rounded-xl border border-border bg-muted p-3 text-center text-sm text-muted-foreground">📸 {photo.name}</div>
        ) : (
          <img src={photo.dataUrl} alt="Uploaded photo of the gift recipient" className="size-48 rounded-xl object-cover shadow-sm" />
        )}
        <button
          type="button"
          aria-label="Remove photo"
          onClick={() => onChange(null)}
          className="absolute -right-3 -top-3 grid size-11 place-items-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-105"
        >
          <X className="size-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-input hover:border-primary/60",
        )}
      >
        <ImagePlus className="size-8 text-primary" />
        <span className="font-semibold">Tap to upload or drag a photo here</span>
        <span className="text-xs text-muted-foreground">JPG, PNG, or HEIC · up to 5MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic"
        className="hidden"
        onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }}
      />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </>
  );
}

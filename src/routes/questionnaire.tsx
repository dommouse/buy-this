import { useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Home, ImagePlus, X } from "lucide-react";

import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { emptyAnswers, useGiftAnswers, type GiftAnswers } from "@/lib/gift-answers-context";
import { cn } from "@/lib/utils";
import {
  autoRelationship,
  buildStepIds,
  getStepDef,
  optionsForStep,
  relationshipTitle,
  resolvePath,
  skipRelationship,
  type QuestionOption,
  type StepId,
} from "@/questionnaire";

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

const MAX_PHOTO = 5 * 1024 * 1024;
const emojiAssets = import.meta.glob<string>("../assets/emoji/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

/** Prefer bundled SVG; fall back to native emoji so every answer shows an icon. */
function EmojiIcon({ emoji }: { emoji: string }) {
  const codePoint = [...emoji]
    .map((character) => character.codePointAt(0)?.toString(16))
    .filter((code) => code && code !== "fe0f")
    .join("-");
  const src = emojiAssets[`../assets/emoji/${codePoint}.svg`];

  if (src) {
    return <img src={src} alt="" aria-hidden="true" className="size-6 shrink-0 object-contain" />;
  }
  return (
    <span className="grid size-6 shrink-0 place-items-center text-lg leading-none" aria-hidden="true">
      {emoji}
    </span>
  );
}

function QuestionnairePage() {
  const navigate = useNavigate();
  const { setAnswers: saveAnswers } = useGiftAnswers();
  const [a, setA] = useState<GiftAnswers>(emptyAnswers);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  const routeAnswers = useMemo(
    () => ({
      occasion: a.occasion,
      relationship: a.relationship,
      ageRange: a.ageRange,
      graduationLevel: a.graduationLevel,
    }),
    [a.occasion, a.relationship, a.ageRange, a.graduationLevel],
  );

  const steps = useMemo(() => buildStepIds(routeAnswers), [routeAnswers]);
  const step = steps[Math.min(index, steps.length - 1)] ?? "occasion";
  const isLast = index === steps.length - 1;
  const progress = ((index + 1) / Math.max(1, steps.length)) * 100;
  const def = getStepDef(step);

  const update = <K extends keyof GiftAnswers>(key: K, value: GiftAnswers[K]) => {
    setA((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "occasion") {
        const auto = autoRelationship(String(value));
        if (auto) next.relationship = auto;
        else if (skipRelationship(prev.occasion) && !skipRelationship(String(value))) {
          next.relationship = "";
        }
        next.ageRange = "";
        next.graduationLevel = "";
        next.budget = "";
        next.interests = [];
      }
      if (key === "relationship") {
        next.ageRange = "";
        next.budget = "";
      }
      next.path = resolvePath({
        occasion: next.occasion,
        relationship: next.relationship,
        ageRange: next.ageRange || (next.graduationLevel ? "20-39" : ""),
        graduationLevel: next.graduationLevel,
      });
      return next;
    });
    setError("");
  };

  const validate = (): string => {
    if (def.optional) return "";
    switch (def.kind) {
      case "multi": {
        const list = (a as Record<string, unknown>)[def.field];
        if (Array.isArray(list) && list.length > 0) return "";
        return "Pick at least one to continue";
      }
      case "text":
        return "";
      case "photo":
        return "";
      default: {
        const v = (a as Record<string, unknown>)[def.field];
        if (typeof v === "string" && v.trim()) {
          if (def.field === "occasion" && v === "Other" && !a.occasionOther.trim()) {
            return "Tell me the occasion";
          }
          if (def.field === "relationship" && v === "Other" && !a.relationshipOther.trim()) {
            return "Tell me who it's for";
          }
          return "";
        }
        return "Pick one to continue";
      }
    }
  };

  const finish = () => {
    const path = resolvePath({
      occasion: a.occasion,
      relationship: a.relationship,
      ageRange: a.ageRange || (a.graduationLevel ? "20-39" : ""),
      graduationLevel: a.graduationLevel,
    });
    // Map path answers into engine-friendly vibe / wants / interests.
    const vibe =
      a.teenStyle ||
      a.parentType ||
      a.personality[0] ||
      a.practicalOrSpecial ||
      a.howFeel ||
      "";
    const wants = [a.talkAbout, a.character, a.feelSeen, a.neverBuy].filter(Boolean).join(" · ");
    const interests =
      a.interests.length > 0
        ? a.interests
        : [a.helpWith, a.familyNeed, a.favorites, a.neverBuy].filter(Boolean);

    const final: GiftAnswers = {
      ...a,
      path,
      vibe,
      wants: a.wants || wants,
      interests,
      ageRange: a.ageRange || (a.graduationLevel ? "20-39" : a.ageRange),
    };
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
    // Clamp index if step list shrank after an answer.
    setIndex((i) => {
      const nextSteps = buildStepIds({
        occasion: a.occasion,
        relationship: a.relationship,
        ageRange: a.ageRange,
        graduationLevel: a.graduationLevel,
      });
      return Math.min(i + 1, Math.max(0, nextSteps.length - 1));
    });
  };

  const skip = () => {
    setError("");
    setDirection(1);
    if (isLast) return finish();
    setIndex((i) => i + 1);
  };

  const back = () => {
    if (index === 0) return;
    setError("");
    setDirection(-1);
    setIndex((i) => i - 1);
  };

  const title =
    step === "relationship" ? relationshipTitle(a.occasion) : def.title;

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
              <span>
                {index + 1} of {steps.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={steps.length}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div
            key={`${step}-${index}`}
            className="animate-question-in px-5 pb-6 pt-4 sm:px-8"
            style={{ ["--q-from" as string]: direction === 1 ? "24px" : "-24px" }}
          >
            <div key={shakeKey} className={cn(shakeKey > 0 && error && "animate-gentle-shake")}>
              <StepBody
                step={step}
                title={title}
                a={a}
                update={update}
                onSkip={skip}
              />
              <p
                className={cn(
                  "mt-4 min-h-5 text-sm text-destructive transition-opacity",
                  error ? "opacity-100" : "opacity-0",
                )}
                role="alert"
              >
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
            <div className="flex items-center gap-2">
              {def.optional && !isLast && (
                <button
                  type="button"
                  onClick={skip}
                  className="min-h-11 px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className={cn(
                  "min-h-11 rounded-full bg-primary font-bold text-primary-foreground shadow-sm transition-all hover:scale-[1.03] hover:bg-primary/90 active:scale-95",
                  isLast ? "px-8 py-3.5 text-base sm:text-lg" : "px-7 py-3 text-sm",
                )}
              >
                {isLast
                  ? a.photo
                    ? "Find My Gifts"
                    : def.optional
                      ? "Skip — Find My Gifts"
                      : "Find My Gifts"
                  : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

type BodyProps = {
  step: StepId;
  title: string;
  a: GiftAnswers;
  update: <K extends keyof GiftAnswers>(key: K, value: GiftAnswers[K]) => void;
  onSkip: () => void;
};

function StepBody({ step, title, a, update, onSkip }: BodyProps) {
  const def = getStepDef(step);
  const options = optionsForStep(step, {
    occasion: a.occasion,
    relationship: a.relationship,
    ageRange: a.ageRange,
  });

  const heading = <Heading title={title} {...(def.sub ? { sub: def.sub } : {})} />;

  if (def.kind === "photo") {
    return (
      <>
        {heading}
        <PhotoUpload photo={a.photo} onChange={(p) => update("photo", p)} />
        <SkipLink onClick={onSkip} />
      </>
    );
  }

  if (def.kind === "text") {
    const value = String((a as Record<string, unknown>)[def.field] ?? "");
    return (
      <>
        {heading}
        <TextField
          value={value}
          onChange={(v) => update(def.field as keyof GiftAnswers, v as never)}
          placeholder={def.placeholder || ""}
        />
        {def.optional && <SkipLink onClick={onSkip} />}
      </>
    );
  }

  if (def.kind === "multi") {
    const field = def.field as "interests" | "personality";
    const selected = (a[field] as string[]) || [];
    const max = def.maxSelect ?? 2;
    const toggle = (v: string) => {
      if (selected.includes(v)) {
        update(field, selected.filter((i) => i !== v) as never);
      } else if (selected.length < max) {
        update(field, [...selected, v] as never);
      }
    };
    return (
      <>
        {heading}
        <p className="mb-3 text-sm font-medium text-primary">
          {selected.length}/{max} selected
        </p>
        <MultiPills options={options} selected={selected} onToggle={toggle} max={max} />
      </>
    );
  }

  const value = String((a as Record<string, unknown>)[def.field] ?? "");
  const onChange = (v: string) => update(def.field as keyof GiftAnswers, v as never);

  return (
    <>
      {heading}
      {def.kind === "pills" ? (
        <Pills options={options} value={value} onChange={onChange} />
      ) : (
        <CardGrid
          options={options}
          value={value}
          onChange={onChange}
          cols={options.length > 6 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}
        />
      )}
      {def.field === "occasion" && value === "Other" && (
        <TextField
          autoFocus
          value={a.occasionOther}
          onChange={(v) => update("occasionOther", v)}
          placeholder="What's the occasion?"
        />
      )}
      {def.field === "relationship" && value === "Other" && (
        <TextField
          autoFocus
          value={a.relationshipOther}
          onChange={(v) => update("relationshipOther", v)}
          placeholder="Who is it for?"
        />
      )}
    </>
  );
}

function Heading({ title, sub }: { title: string; sub?: string | undefined }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
      {sub ? <p className="mt-2 text-sm text-muted-foreground sm:text-base">{sub}</p> : null}
    </div>
  );
}

function CardGrid({
  options,
  value,
  onChange,
  cols = "grid-cols-2 sm:grid-cols-3",
}: {
  options: QuestionOption[];
  value: string;
  onChange: (v: string) => void;
  cols?: string;
}) {
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
              "relative flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/60 active:scale-[0.98]",
              on ? "border-primary bg-accent shadow-sm" : "border-border bg-card",
            )}
          >
            <EmojiIcon emoji={o.emoji} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{o.value}</span>
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

function Pills({
  options,
  value,
  onChange,
}: {
  options: QuestionOption[];
  value: string;
  onChange: (v: string) => void;
}) {
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

function MultiPills({
  options,
  selected,
  onToggle,
  max,
}: {
  options: QuestionOption[];
  selected: string[];
  onToggle: (v: string) => void;
  max: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option.value);
        const disabled = !on && selected.length >= max;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60",
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
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
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
    <button
      type="button"
      onClick={onClick}
      className="mt-3 min-h-11 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
    >
      Skip this one
    </button>
  );
}

function PhotoUpload({
  photo,
  onChange,
}: {
  photo: GiftAnswers["photo"];
  onChange: (p: GiftAnswers["photo"]) => void;
}) {
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
    reader.onload = () =>
      onChange({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  if (photo) {
    const isHeic = /heic|heif/i.test(photo.type) || /\.heic$/i.test(photo.name);
    return (
      <div className="relative mx-auto w-fit">
        {isHeic ? (
          <div className="grid size-48 place-items-center rounded-xl border border-border bg-muted p-3 text-center text-sm text-muted-foreground">
            📸 {photo.name}
          </div>
        ) : (
          <img
            src={photo.dataUrl}
            alt="Uploaded photo of the gift recipient"
            className="size-48 rounded-xl object-cover shadow-sm"
          />
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
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-sm text-muted-foreground transition-colors",
          dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50",
        )}
      >
        <ImagePlus className="size-8 text-primary" />
        <span>Tap to upload or drag a photo here</span>
        <span className="text-xs">JPG, PNG, or HEIC · max 5MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}

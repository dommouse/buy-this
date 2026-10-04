import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Dices,
  Gem,
  Gift,
  Home,
  Loader2,
  Mail,
  MailCheck,
  RotateCcw,
  Send,
  ShoppingCart,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";

import logoUrl from "@/assets/relationship-concierge-logo.png";
import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { createEmailCapture } from "@/db/repositories/email-captures";
import { createGiftSearch } from "@/db/repositories/gift-searches";
import {
  getRecommendations,
  productSourceLabel,
  trackInteraction,
  type Recommendation,
  type RecommendationResult,
} from "@/engine";
import { useGiftAnswers, type GiftAnswers } from "@/lib/gift-answers-context";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your Gift Picks — BUY THIS" },
      { name: "description", content: "Your curated BUY THIS gift recommendations." },
      { property: "og:title", content: "Your Gift Picks — BUY THIS" },
      { property: "og:description", content: "Your curated BUY THIS gift recommendations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

const slotMeta: Record<string, { emoji: string; subtitle: string; icon: LucideIcon }> = {
  "The One": { emoji: "🎯", subtitle: "The gift that just FITS.", icon: Target },
  "The Wow": { emoji: "✨", subtitle: "The unexpected showstopper.", icon: Sparkles },
  "The Smart Pick": { emoji: "🧠", subtitle: "Practical but thoughtful.", icon: Brain },
  "The Wildcard": { emoji: "🃏", subtitle: "Because sometimes the best gift is a surprise.", icon: Dices },
};

const defaultTip =
  "Pro tip from your Gift Brain: Wrap this in brown kraft paper with a pink ribbon for that perfect unboxing moment. Presentation is everything!";

function toProfile(answers: GiftAnswers) {
  return {
    relationship: answers.relationshipOther || answers.relationship || "",
    occasion: answers.occasionOther || answers.occasion || "",
    ageRange: answers.ageRange || "",
    gender: answers.gender || "",
    vibe: answers.vibe || "",
    interests: answers.interests,
    wants: answers.wants || "",
    avoid: answers.avoid || "",
    budget: answers.budget || "",
    hasKids: answers.hasKids || "",
    giftType: answers.giftType || "",
  };
}

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

function ResultsPage() {
  const { answers, setAnswers, searchId, setSearchId } = useGiftAnswers();
  const [emailOpen, setEmailOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const sessionIdRef = useRef(crypto.randomUUID());
  const bootstrappedRef = useRef(false);
  const trackedRef = useRef(false);

  // Save the search, then ask the engine for picks (one bootstrap per visit).
  useEffect(() => {
    if (!answers || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      let nextSearchId = searchId;
      if (!nextSearchId) {
        try {
          nextSearchId = await createGiftSearch({
            session_id: sessionIdRef.current,
            recipient_relationship: answers.relationshipOther || answers.relationship || null,
            recipient_age_range: answers.ageRange || null,
            recipient_gender: answers.gender || null,
            occasion: answers.occasionOther || answers.occasion || null,
            interests: answers.interests.length ? answers.interests : null,
            budget_range: answers.budget || null,
            photo_url: null,
            recommendations: null,
          });
          setSearchId(nextSearchId);
        } catch (err) {
          console.error("BUY THIS: failed to save gift search", err);
        }
      }

      try {
        const data = await getRecommendations({
          data: {
            profile: toProfile(answers),
            searchId: nextSearchId,
            sessionId: sessionIdRef.current,
          },
        });
        setResult(data);
        setPage(0);
      } catch (err) {
        console.error("BUY THIS: recommendations failed", err);
        setError("We couldn't load personalized picks right now. Try Start Over.");
        bootstrappedRef.current = false;
      } finally {
        setLoading(false);
      }
    })();
  }, [answers, searchId, setSearchId]);

  // Log impressions once for the returned set.
  useEffect(() => {
    if (!result?.items.length || trackedRef.current) return;
    trackedRef.current = true;
    for (const item of result.items) {
      trackInteraction({
        type: "impression",
        productId: item.product.id,
        recommendationId: result.recommendationId,
        searchId,
        sessionId: sessionIdRef.current,
        rank: item.rank,
      });
    }
  }, [result, searchId]);

  const tip = result?.tip || defaultTip;
  const items = result?.items ?? [];
  const pageSize = Math.max(1, result?.pageSize || 4);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <main className="min-h-dvh bg-background px-4 pb-10 pt-20 text-foreground sm:px-6 sm:pt-24">
      <AppMenu />
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 text-center sm:mb-10">
          <img src={logoUrl} alt="BUY THIS - Relationship Concierge" className="mx-auto w-28 sm:w-36" />
          <h1 className="mt-4 flex items-center justify-center gap-2 text-3xl font-bold leading-tight sm:text-4xl">
            <Gift className="size-8 text-primary sm:size-9" aria-hidden="true" />
            Here's What to Buy!
            <span className="sr-only">🎁</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Curated by Dominique, your Gift Brain <span className="sr-only">🦁</span>
          </p>
          {items.length > 0 && !loading && !error && (
            <p className="mt-2 text-sm text-muted-foreground">
              {items.length} gift{items.length === 1 ? "" : "s"} ranked by fit & popularity
              {totalPages > 1 ? ` · page ${safePage + 1} of ${totalPages}` : ""}
            </p>
          )}
        </header>

        {!answers && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No questionnaire answers yet.</p>
            <Button asChild className="mt-5 min-h-12 rounded-full font-bold">
              <Link to="/questionnaire">Start the questionnaire</Link>
            </Button>
          </div>
        )}

        {answers && loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground" role="status">
            <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
            <p className="font-medium">Dominique is picking your gifts…</p>
          </div>
        )}

        {answers && error && !loading && (
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button asChild variant="outline" className="mt-5 min-h-12 rounded-full border-primary font-bold text-primary">
              <Link
                to="/questionnaire"
                onClick={() => {
                  setAnswers(null);
                  setSearchId(null);
                }}
              >
                Start Over
              </Link>
            </Button>
          </div>
        )}

        {answers && !loading && !error && items.length > 0 && (
          <>
            <section className="grid gap-5 md:grid-cols-2" aria-label="Gift recommendations">
              {pageItems.map((item) => (
                <GiftCard
                  key={`${item.rank}-${item.product.id}`}
                  item={item}
                  recommendationId={result?.recommendationId ?? null}
                  searchId={searchId}
                  sessionId={sessionIdRef.current}
                />
              ))}
            </section>

            {totalPages > 1 && (
              <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Gift pages">
                <Button
                  type="button"
                  variant="outline"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="min-h-11 rounded-full border-primary px-5 font-bold text-primary"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Previous
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={i === safePage ? "default" : "outline"}
                      aria-current={i === safePage ? "page" : undefined}
                      onClick={() => setPage(i)}
                      className="size-10 rounded-full p-0 font-bold"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="min-h-11 rounded-full border-primary px-5 font-bold text-primary"
                >
                  Next
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </nav>
            )}

            <aside className="mt-7 rounded-2xl border border-primary/25 bg-accent p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <img src={logoUrl} alt="Relationship Concierge" width={48} height={48} className="size-12 shrink-0 object-contain" />
                <div>
                  <h2 className="font-bold">Dominique's Gift Tip ✨</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{tip}</p>
                </div>
              </div>
            </aside>

            <div className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
              <Button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmailOpen(true);
                  trackInteraction({
                    type: "email_picks",
                    recommendationId: result?.recommendationId,
                    searchId,
                    sessionId: sessionIdRef.current,
                  });
                }}
                className="min-h-12 rounded-full font-bold"
              >
                <Mail className="size-4" aria-hidden="true" />
                Email These to Me
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-12 rounded-full border-primary bg-transparent font-bold text-primary hover:bg-accent hover:text-primary"
              >
                <Link
                  to="/questionnaire"
                  onClick={() => {
                    setAnswers(null);
                    setSearchId(null);
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start Over
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-12 rounded-full border-primary bg-transparent font-bold text-primary hover:bg-accent hover:text-primary"
              >
                <Link to="/">
                  <Home className="size-4" aria-hidden="true" />
                  Home
                </Link>
              </Button>
            </div>

            <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-5 text-branding sm:text-sm">
              Want to save your picks and get birthday reminders? Concierge+ membership coming soon!{" "}
              <Gem className="inline size-4 text-primary" aria-label="diamond" />
            </p>
          </>
        )}
      </div>

      {emailOpen && <EmailModal sent={sent} searchId={searchId} onSent={() => setSent(true)} onClose={() => setEmailOpen(false)} />}
    </main>
  );
}

function GiftCard({
  item,
  recommendationId,
  searchId,
  sessionId,
}: {
  item: Recommendation;
  recommendationId: string | null;
  searchId: string | null;
  sessionId: string;
}) {
  const meta = slotMeta[item.slot] ?? slotMeta["The One"]!;
  const CategoryIcon = meta.icon;
  const { product } = item;
  const source = productSourceLabel(product.provider, product.buyUrl);
  const [imgFailed, setImgFailed] = useState(false);

  const onBuy = () => {
    trackInteraction({
      type: "buy_click",
      productId: product.id,
      recommendationId,
      searchId,
      sessionId,
      rank: item.rank,
    });
    trackInteraction({
      type: "click",
      productId: product.id,
      recommendationId,
      searchId,
      sessionId,
      rank: item.rank,
    });
    window.open(product.buyUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_8px_30px_-12px_oklch(0.4_0.1_350/0.2)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <CategoryIcon className="size-5 text-primary" aria-hidden="true" />
          {item.slot}
          <span className="sr-only">{meta.emoji}</span>
        </h2>
        <span
          className={
            source.id === "amazon"
              ? "shrink-0 rounded-md bg-[#FF9900]/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#B35900]"
              : "shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
          }
          title={`Available via ${source.label}`}
        >
          {source.label}
        </span>
      </div>
      <p className="mt-1 min-h-6 text-sm text-muted-foreground">{meta.subtitle}</p>
      <div className="relative mx-auto my-5 grid aspect-square w-full max-w-52 place-items-center overflow-hidden rounded-xl bg-muted">
        {product.imageUrl && !imgFailed ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="size-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Gift className="size-16 text-primary/55" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-bold">{product.title}</h3>
        <p className="mt-1 text-xl font-bold text-primary">{formatPrice(product.price, product.currency)}</p>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.reason || product.description}</p>
        <Button type="button" onClick={onBuy} className="mt-5 min-h-12 w-full rounded-full text-sm font-bold">
          BUY THIS <ShoppingCart className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

function EmailModal({
  sent,
  searchId,
  onSent,
  onClose,
}: {
  sent: boolean;
  searchId: string | null;
  onSent: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (typeof email === "string" && email) {
      try {
        await createEmailCapture({ email, search_id: searchId, source: "results_page" });
      } catch (err) {
        console.error("BUY THIS: failed to save email", err);
      }
    }
    onSent();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-overlay px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-dialog-title"
        className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl sm:p-8"
      >
        <Button
          ref={closeRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close email form"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full"
        >
          <X className="size-5" />
        </Button>
        {sent ? (
          <div className="py-8 text-center" role="status">
            <MailCheck className="mx-auto size-12 text-primary" aria-hidden="true" />
            <h2 id="email-dialog-title" className="mt-4 text-2xl font-bold">
              Check your inbox! <span className="sr-only">💌</span>
            </h2>
            <Button type="button" onClick={onClose} className="mt-6 min-h-11 rounded-full px-7 font-bold">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="email-dialog-title" className="pr-10 text-2xl font-bold">
              Email These to Me
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Enter your email and we'll send your gift picks.</p>
            <label htmlFor="results-email" className="mt-5 block text-sm font-semibold">
              Email address
            </label>
            <input
              id="results-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <Button type="submit" className="mt-4 min-h-12 w-full rounded-full font-bold">
              <Send className="size-4" aria-hidden="true" />
              Send
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

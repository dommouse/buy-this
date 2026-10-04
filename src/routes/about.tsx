import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { AppMenu } from "@/components/app-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & FAQ — BUY THIS" },
      { name: "description", content: "Meet your gift brain — learn how BUY THIS finds the perfect gift, for free." },
      { property: "og:title", content: "About & FAQ — BUY THIS" },
      { property: "og:description", content: "Meet your gift brain — learn how BUY THIS finds the perfect gift, for free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const FAQS = [
  {
    q: "How does BUY THIS work?",
    a: "Click the BUY THIS button, answer a few quick questions about the person you're shopping for, and we'll give you 4 perfect gift recommendations with direct links to buy them.",
  },
  {
    q: "Is it really free?",
    a: "Yes! BUY THIS is 100% free to use, no account needed. We earn a small commission when you purchase through our links, which keeps the tool free for everyone.",
  },
  {
    q: "Do I have to create an account?",
    a: "Nope! Use BUY THIS as many times as you want without signing up. Creating a free account just lets you save your results and unlock bonus content.",
  },
  {
    q: "What makes this different from a gift guide?",
    a: "Gift guides give everyone the same generic list. BUY THIS learns about YOUR specific person — their personality, style, interests, and your budget — then picks gifts matched to THEM.",
  },
  {
    q: "Who is Relationship Concierge?",
    a: "Relationship Concierge was founded by Dominique to help people show love through better gift-giving. BUY THIS is our flagship tool — powered by real gift-giving expertise, not random algorithms.",
  },
];

function AboutPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <main className="relative min-h-dvh bg-background px-6 py-20 sm:py-24">
      <AppMenu />
      <div className="mx-auto w-full max-w-xl">
        <section className="text-center">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Meet Your Gift Brain
          </h1>
          <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            I'm Dominique, founder of Relationship Concierge. For years I've been
            the go-to person everyone calls when they don't know what to buy. I
            built BUY THIS so you can get that same perfect-gift magic —
            instantly, for free. Tell me about the person, and I'll tell you
            what to buy. It's that simple.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
            FAQ
          </h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {FAQS.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div key={faq.q}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-primary sm:text-base"
                  >
                    {faq.q}
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-all duration-200",
                      open ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <p className="overflow-hidden text-sm leading-6 text-muted-foreground">
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mt-12 text-center">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Back to Home
          </Link>
        </p>
      </div>
    </main>
  );
}

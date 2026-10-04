import { Link, createFileRoute } from "@tanstack/react-router";

import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/relationship-concierge-logo.png";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUY THIS — AI Gift Concierge" },
      {
        name: "description",
        content: "Find the perfect gift for every person and every occasion with BUY THIS.",
      },
      { property: "og:title", content: "BUY THIS — AI Gift Concierge" },
      {
        property: "og:description",
        content: "Every person. Every occasion. The perfect gift.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative grid min-h-dvh grid-rows-[1fr_auto] bg-background px-6 pb-5 pt-20 sm:pb-6 sm:pt-24">
      <AppMenu />
      <section className="flex min-h-0 items-center justify-center">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="BUY THIS - Relationship Concierge"
            className="w-[200px] sm:w-[300px]"
          />

          <p className="mt-7 text-balance text-xl font-medium leading-8 text-foreground sm:mt-8 sm:text-2xl">
            Every person. Every occasion. The perfect gift.
          </p>
          <Button
            asChild
            className="mt-8 h-14 w-full max-w-sm rounded-lg px-10 text-base font-bold uppercase shadow-md transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] sm:w-auto sm:min-w-56"
          >
            <Link to="/questionnaire">BUY THIS</Link>
          </Button>
        </div>
      </section>
      <p className="pt-8 text-center text-xs text-branding">Powered by Relationship Concierge</p>
    </main>
  );
}

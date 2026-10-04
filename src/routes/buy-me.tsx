import { createFileRoute } from "@tanstack/react-router";

import { WaitlistPage } from "@/components/waitlist-page";

export const Route = createFileRoute("/buy-me")({
  head: () => ({
    meta: [
      { title: "BUY ME — BUY THIS" },
      { name: "description", content: "Join the list for BUY THIS Treat Yourself Mode." },
      { property: "og:title", content: "BUY ME — BUY THIS" },
      { property: "og:description", content: "Join the list for BUY THIS Treat Yourself Mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WaitlistPage
      title="BUY ME — Treat Yourself Mode — Coming Soon!"
      description="Enter your email to be the first to know:"
    />
  ),
});
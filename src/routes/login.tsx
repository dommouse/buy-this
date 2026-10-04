import { createFileRoute } from "@tanstack/react-router";

import { WaitlistPage } from "@/components/waitlist-page";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Member Login — BUY THIS" },
      { name: "description", content: "Join the list for BUY THIS member access." },
      { property: "og:title", content: "Member Login — BUY THIS" },
      { property: "og:description", content: "Join the list for BUY THIS member access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WaitlistPage
      title="Member Login — Coming Soon!"
      description="Enter your email to be the first to know:"
    />
  ),
});
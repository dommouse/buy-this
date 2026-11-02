import { createFileRoute, redirect } from "@tanstack/react-router";

/** BUY ME / Find A Gift are the same flow — questionnaire. */
export const Route = createFileRoute("/buy-me")({
  beforeLoad: () => {
    throw redirect({ to: "/questionnaire" });
  },
  component: () => null,
});

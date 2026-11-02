import { createFileRoute, redirect } from "@tanstack/react-router";

import { portalLogout } from "@/admin/modules/users/portal-auth.functions";

export const Route = createFileRoute("/logout")({
  beforeLoad: async () => {
    try {
      await portalLogout();
    } catch {
      /* ignore */
    }
    throw redirect({ to: "/" });
  },
  component: () => null,
});

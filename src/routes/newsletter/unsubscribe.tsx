import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { unsubscribeByToken } from "@/admin/modules/newsletter/newsletter.functions";
import { AdminSpinner } from "@/admin/components/loading";
import { PortalShell } from "@/components/portal/portal-shell";

export const Route = createFileRoute("/newsletter/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s["token"] === "string" ? s["token"] : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing unsubscribe token.");
      return;
    }
    (async () => {
      try {
        const res = await unsubscribeByToken({ data: { token } });
        setStatus("ok");
        setMessage(`Unsubscribed ${res.email}.`);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Unsubscribe failed");
      }
    })();
  }, [token]);

  return (
    <PortalShell title="Newsletter">
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="text-2xl font-semibold">Newsletter</h1>
        {status === "loading" ? <AdminSpinner /> : null}
        {status !== "loading" ? (
          <p className={`mt-4 ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
        ) : null}
      </div>
    </PortalShell>
  );
}

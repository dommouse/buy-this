import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getPublicSiteSettings } from "@/admin/modules/settings/settings.functions";
import { PortalShell } from "@/components/portal/portal-shell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — BUY THIS" },
      { name: "description", content: "Get in touch with the BUY THIS team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [email, setEmail] = useState("hello@buythis.app");

  useEffect(() => {
    getPublicSiteSettings()
      .then((s) => {
        const v = s["supportEmail"];
        if (typeof v === "string" && v.trim()) setEmail(v.trim());
      })
      .catch(() => undefined);
  }, []);

  return (
    <PortalShell title="Contact">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contact us</h1>
        <p className="mt-3 text-muted-foreground">
          Questions about BUY THIS, partnerships, or press? We&apos;d love to hear from you.
        </p>
        <div className="mt-8 rounded-xl border bg-card p-6">
          <p className="text-sm font-medium text-foreground">Email</p>
          <a href={`mailto:${email}`} className="mt-1 block text-lg text-primary hover:underline">
            {email}
          </a>
          <p className="mt-6 text-sm text-muted-foreground">
            For gift help, the fastest path is the{" "}
            <a href="/questionnaire" className="font-medium text-primary hover:underline">
              BUY THIS wizard
            </a>
            .
          </p>
        </div>
      </div>
    </PortalShell>
  );
}

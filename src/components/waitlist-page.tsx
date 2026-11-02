import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { subscribeNewsletter } from "@/admin/modules/newsletter/newsletter.functions";
import { ButtonSpinner } from "@/admin/components/loading";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

export function WaitlistPage({ title, description }: { title: string; description: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (typeof email !== "string" || !email.trim()) return;
    setLoading(true);
    try {
      await subscribeNewsletter({ data: { email: email.trim(), source: "waitlist" } });
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not subscribe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalShell title="BUY ME">
      <Toaster richColors position="top-right" />
      <div className="mx-auto grid max-w-xl place-items-center py-10 text-center">
        <h1 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
        {submitted ? (
          <p role="status" className="mt-8 text-base font-medium text-primary">
            You're on the list. We'll be in touch.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 grid w-full max-w-md gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 bg-card px-4 shadow-none"
              disabled={loading}
            />
            <Button type="submit" className="h-12 px-6 font-bold uppercase" disabled={loading}>
              {loading ? <ButtonSpinner /> : null}
              Notify Me
            </Button>
          </form>
        )}
        <Button asChild variant="link" className="mt-7 h-auto px-2 text-base">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </PortalShell>
  );
}

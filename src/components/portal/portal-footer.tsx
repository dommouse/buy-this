import { Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { subscribeNewsletter } from "@/admin/modules/newsletter/newsletter.functions";
import { getPublicSiteSettings } from "@/admin/modules/settings/settings.functions";
import type { SettingsMap } from "@/admin/lib/settings.server";
import { ButtonSpinner } from "@/admin/components/loading";
import logoUrl from "@/assets/relationship-concierge-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmLeaveQuestionnaire } from "@/lib/confirm-leave";

export function PortalFooter({
  confirmLeave = false,
  onLeaveConfirmed,
}: {
  /** When true (questionnaire), warn before navigating away. */
  confirmLeave?: boolean;
  onLeaveConfirmed?: () => void;
}) {
  const [site, setSite] = useState<SettingsMap>({});
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPublicSiteSettings()
      .then(setSite)
      .catch(() => undefined);
  }, []);

  async function onSubscribe(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await subscribeNewsletter({ data: { email: email.trim(), source: "footer" } });
      toast.success("You're subscribed");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subscribe failed");
    } finally {
      setBusy(false);
    }
  }

  async function go(to: string) {
    if (confirmLeave) {
      const ok = await confirmLeaveQuestionnaire();
      if (!ok) return;
      onLeaveConfirmed?.();
    }
    // Dynamic footer destinations — href navigation keeps types simple
    window.location.assign(to);
  }

  const support = String(site["supportEmail"] ?? "hello@buythis.app");
  const appName = String(site["appName"] ?? "Relationship Concierge");
  const instagram = String(site["socialInstagram"] ?? "");
  const twitter = String(site["socialTwitter"] ?? "");
  const facebook = String(site["socialFacebook"] ?? "");

  return (
    <footer className="border-t border-white/40 bg-white/40 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <img
            src={logoUrl}
            alt="Relationship Concierge"
            className="h-16 w-auto max-w-[220px] object-contain object-left sm:h-20"
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            AI gift concierge from Relationship Concierge — personal picks for every person and occasion.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <button type="button" className="hover:text-primary" onClick={() => go("/questionnaire")}>
                Buy This
              </button>
            </li>
            <li>
              <button type="button" className="hover:text-primary" onClick={() => go("/blogs")}>
                Blogs
              </button>
            </li>
            <li>
              <button type="button" className="hover:text-primary" onClick={() => go("/about")}>
                About us
              </button>
            </li>
            <li>
              <button type="button" className="hover:text-primary" onClick={() => go("/contact")}>
                Contact us
              </button>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <button type="button" className="hover:text-primary" onClick={() => go("/login")}>
                Login / Register
              </button>
            </li>
            <li>
              <a href={`mailto:${support}`} className="hover:text-primary">
                {support}
              </a>
            </li>
          </ul>
          {(instagram || twitter || facebook) && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {instagram ? (
                <a href={instagram} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                  Instagram
                </a>
              ) : null}
              {twitter ? (
                <a href={twitter} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                  X / Twitter
                </a>
              ) : null}
              {facebook ? (
                <a href={facebook} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                  Facebook
                </a>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">Newsletter</p>
          <p className="mt-2 text-sm text-muted-foreground">Gift tips and new features — no spam.</p>
          <form onSubmit={onSubscribe} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="bg-white/70"
            />
            <Button type="submit" disabled={busy} className="shrink-0">
              {busy ? <ButtonSpinner /> : null}
              Join
            </Button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/50 px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {appName}. Powered by Relationship Concierge.
      </div>
      {/* Keep Link for crawlers / SSR awareness */}
      <div className="sr-only">
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </div>
    </footer>
  );
}

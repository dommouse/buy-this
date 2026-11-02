import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getPortalSession, portalLogout } from "@/admin/modules/users/portal-auth.functions";
import type { PublicPortalUser } from "@/admin/auth/session.server";
import logoUrl from "@/assets/relationship-concierge-logo.png";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { confirmLeaveQuestionnaire } from "@/lib/confirm-leave";
import { useGiftAnswers } from "@/lib/gift-answers-context";
import { cn } from "@/lib/utils";
import { PortalFooter } from "./portal-footer";
import { PORTAL_NAV } from "./portal-nav";

export function PortalShell({
  children,
  title,
  fullBleed = false,
  /** Landing / dashboard — glossy single-page feel */
  landing = false,
  /** Hide sidebar + topbar (questionnaire fullscreen); footer stays */
  hideChrome = false,
  /** Confirm before leaving via footer / any shell nav */
  confirmLeave = false,
}: {
  children: React.ReactNode;
  title?: string;
  fullBleed?: boolean;
  landing?: boolean;
  hideChrome?: boolean;
  confirmLeave?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setAnswers, setSearchId } = useGiftAnswers();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<PublicPortalUser | null>(null);

  useEffect(() => {
    getPortalSession()
      .then(setUser)
      .catch(() => setUser(null));
  }, [pathname]);

  function clearProgress() {
    setAnswers(null);
    setSearchId(null);
  }

  async function navigateGuarded(to: string) {
    if (confirmLeave) {
      const ok = await confirmLeaveQuestionnaire();
      if (!ok) return;
      clearProgress();
    }
    setOpen(false);
    window.location.assign(to);
  }

  async function logout() {
    try {
      await portalLogout();
      setUser(null);
      window.location.href = "/";
    } catch {
      /* ignore */
    }
  }

  const initials = (user?.name || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
      {PORTAL_NAV.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigateGuarded(item.to)}
            className={cn(
              "rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/80 hover:bg-white/60",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className={cn("flex min-h-dvh flex-col text-foreground", landing || hideChrome ? "portal-gloss" : "portal-gloss")}>
      {!hideChrome ? (
        <header className="sticky top-0 z-40 border-b border-white/40 bg-white/50 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>

            {!landing ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title || "Relationship Concierge"}</p>
                <p className="truncate text-xs text-muted-foreground">Every person. Every occasion. The perfect gift.</p>
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}

            <div className="flex shrink-0 items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Account menu"
                    >
                      <Avatar className="size-9 border border-white/60 shadow-sm">
                        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()}>
                      <LogOut className="size-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link to="/login">Login</Link>
                  </Button>
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/register">
                      <UserRound className="size-3.5" />
                      Register
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      ) : null}

      <main className={cn("flex-1", fullBleed || landing || hideChrome ? "" : "px-4 py-6 sm:px-6 lg:px-8")}>
        {children}
      </main>

      <PortalFooter confirmLeave={confirmLeave} onLeaveConfirmed={clearProgress} />
      <Toaster richColors position="top-right" />

      {open && !hideChrome ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="glass-drawer absolute inset-y-0 left-0 flex w-[min(88vw,18rem)] flex-col border-r border-white/50">
            <div className="flex items-center justify-between border-b border-white/40 px-3 py-3">
              <button type="button" className="rounded-md p-2 hover:bg-white/50" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex justify-center border-b border-white/40 px-4 py-5">
              <Link to="/" onClick={() => setOpen(false)} className="block">
                <img
                  src={logoUrl}
                  alt="Relationship Concierge"
                  className="h-20 w-auto max-w-[200px] object-contain sm:h-24"
                />
              </Link>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  );
}

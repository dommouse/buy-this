import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getSiteSettings } from "@/admin/modules/settings/settings.functions";
import logoUrl from "@/assets/relationship-concierge-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminLogout } from "../auth/auth.functions";
import type { PublicAdmin } from "../auth/session.server";
import { ADMIN_NAV } from "./nav";

export function AdminShell({ admin, children }: { admin: PublicAdmin; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [appName, setAppName] = useState("Admin");

  useEffect(() => {
    function loadName() {
      getSiteSettings()
        .then((s) => {
          const name = s["appName"];
          if (typeof name === "string" && name.trim()) setAppName(name.trim());
        })
        .catch(() => undefined);
    }
    loadName();
    const onUpdated = () => loadName();
    window.addEventListener("site-settings-updated", onUpdated);
    return () => window.removeEventListener("site-settings-updated", onUpdated);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await adminLogout();
      window.location.href = "/admin/login";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logout failed");
      setLoggingOut(false);
    }
  }

  const nav = (compact: boolean) => (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {ADMIN_NAV.map((item) => {
        const active =
          item.to === "/admin" ? pathname === "/admin" : pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            title={item.label}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              compact && "justify-center px-2",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!compact ? item.label : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="portal-gloss min-h-screen text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "glass-panel sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/50 md:flex",
            collapsed ? "w-[4.25rem]" : "w-60",
          )}
        >
          <div className={cn("border-b border-white/40 px-3 py-4", collapsed ? "px-2" : "")}>
            <Link to="/admin" className="flex justify-center">
              <img
                src={logoUrl}
                alt={appName}
                className={cn("object-contain", collapsed ? "h-10 w-10" : "h-16 w-auto max-w-[180px]")}
              />
            </Link>
            {!collapsed ? (
              <p className="mt-2 truncate text-center text-xs text-muted-foreground">{appName} · Admin</p>
            ) : null}
          </div>
          {nav(collapsed)}
          <div className="space-y-2 border-t border-white/40 p-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full", collapsed && "px-0")}
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!collapsed ? <span className="ml-1">Collapse</span> : null}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn("w-full justify-start bg-white/40", collapsed && "justify-center px-0")}
              onClick={logout}
              disabled={loggingOut}
            >
              <LogOut className="size-4" />
              {!collapsed ? (loggingOut ? "Signing out…" : "Sign out") : null}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/40 bg-white/50 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl p-2 hover:bg-white/60 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <div>
                <p className="text-sm font-semibold">{appName} Admin</p>
                <p className="text-xs text-muted-foreground">{admin.email}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="md:hidden" onClick={logout} disabled={loggingOut}>
              <LogOut className="size-4" />
            </Button>
          </header>

          {mobileOpen ? (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileOpen(false)}
                aria-label="Close overlay"
              />
              <div className="glass-drawer absolute inset-y-0 left-0 flex w-72 flex-col">
                <div className="flex items-center justify-between border-b border-white/40 px-4 py-3">
                  <img src={logoUrl} alt={appName} className="h-12 w-auto object-contain" />
                  <button type="button" className="rounded-md p-2 hover:bg-white/50" onClick={() => setMobileOpen(false)}>
                    <X className="size-5" />
                  </button>
                </div>
                <p className="px-4 pt-2 text-xs text-muted-foreground">{appName} · Admin</p>
                {nav(false)}
              </div>
            </div>
          ) : null}

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

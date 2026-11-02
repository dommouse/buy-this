import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { adminLogin, getAdminSession } from "@/admin/auth/auth.functions";
import { ButtonSpinner } from "@/admin/components/loading";
import logoUrl from "@/assets/relationship-concierge-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : "/admin",
  }),
  beforeLoad: async () => {
    const admin = await getAdminSession();
    if (admin) throw redirect({ to: "/admin" });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin({ data: { email, password } });
      toast.success("Welcome back");
      await navigate({ to: redirectTo.startsWith("/admin") ? redirectTo : "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Toaster richColors position="top-right" />
      <div className="mb-8 flex w-full max-w-md flex-col items-center text-center">
        <img
          src={logoUrl}
          alt="BUY THIS - Relationship Concierge"
          className="w-[180px] sm:w-[240px]"
        />
        <p className="mt-5 text-balance text-lg font-medium leading-7 text-foreground sm:text-xl">
          Every person. Every occasion. The perfect gift.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Admin portal</p>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <ButtonSpinner /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

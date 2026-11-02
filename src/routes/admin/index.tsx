import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner } from "@/admin/components/loading";
import { getDashboardStats } from "@/admin/modules/dashboard/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <AdminSpinner label="Loading dashboard…" />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!stats) return null;

  const cards = [
    { label: "Searches (7d)", value: stats.searches7d },
    { label: "Buy clicks (7d)", value: stats.buyClicks7d },
    { label: "Catalog live", value: stats.catalogLive },
    { label: "Catalog dead", value: stats.catalogDead },
    { label: "Newsletter subs", value: stats.newsletterSubs },
    { label: "Published blogs", value: stats.publishedBlogs },
    { label: "Active admins", value: stats.activeAdmins },
    { label: "Portal users", value: stats.portalUsers },
    { label: "Engine", value: stats.engineEnabled ? "On" : "Off" },
  ];

  return (
    <div>
      <AdminPageHeader title="Dashboard" description="Overview of BUY THIS gift brain and portal activity." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {stats.recentSearches.length ? (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Recent gift searches</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Occasion</th>
                  <th className="px-3 py-2 font-medium">Relationship</th>
                  <th className="px-3 py-2 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSearches.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{s.occasion || "—"}</td>
                    <td className="px-3 py-2">{s.recipient_relationship || "—"}</td>
                    <td className="px-3 py-2">{s.budget_range || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

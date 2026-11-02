import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/admin/auth/session.server";
import { getEngineDb } from "@/engine/data/server-db";
import { getAppSetting } from "@/admin/lib/settings.server";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = getEngineDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    searches,
    buyClicks,
    catalogLive,
    catalogDead,
    newsletterSubs,
    publishedBlogs,
    activeAdmins,
    portalUsers,
    recentSearches,
    giftBrain,
  ] = await Promise.all([
    db.from("gift_searches").select("id", { count: "exact", head: true }).gte("created_at", since),
    db
      .from("interaction_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "buy_click")
      .gte("created_at", since),
    db.from("gift_catalog").select("id", { count: "exact", head: true }).eq("is_dead", false),
    db.from("gift_catalog").select("id", { count: "exact", head: true }).eq("is_dead", true),
    db
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed"),
    db.from("blogs").select("id", { count: "exact", head: true }).eq("status", "published"),
    db.from("admin_users").select("id", { count: "exact", head: true }).eq("is_active", true),
    db.from("portal_users").select("id", { count: "exact", head: true }),
    db
      .from("gift_searches")
      .select("id, created_at, occasion, recipient_relationship, budget_range")
      .order("created_at", { ascending: false })
      .limit(8),
    getAppSetting("gift_brain"),
  ]);

  return {
    searches7d: searches.count ?? 0,
    buyClicks7d: buyClicks.count ?? 0,
    catalogLive: catalogLive.count ?? 0,
    catalogDead: catalogDead.count ?? 0,
    newsletterSubs: newsletterSubs.count ?? 0,
    publishedBlogs: publishedBlogs.count ?? 0,
    activeAdmins: activeAdmins.count ?? 0,
    portalUsers: portalUsers.count ?? 0,
    recentSearches: recentSearches.data ?? [],
    engineEnabled: Boolean(giftBrain?.["ENGINE_ENABLED"] ?? true),
  };
});

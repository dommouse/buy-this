import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { getEngineDb } from "@/engine/data/server-db";

export const listNewsletterSubscribers = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        q: z.string().max(100).optional(),
        status: z.enum(["all", "subscribed", "unsubscribed"]).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = getEngineDb()
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data?.q?.trim()) q = q.ilike("email", `%${data.q.trim()}%`);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateSubscriberStatus = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["subscribed", "unsubscribed"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb()
      .from("newsletter_subscribers")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "update", "newsletter_subscribers", data.id, { status: data.status });
    return { ok: true };
  });

export const getNewsletterSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await getEngineDb().from("newsletter_settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data;
});

export const saveNewsletterSettings = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        enabled: z.boolean(),
        from_name: z.string().min(1).max(120),
        footer_html: z.string().max(20_000),
        double_opt_in: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { data: row, error } = await getEngineDb()
      .from("newsletter_settings")
      .upsert({ id: 1, ...data, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "update", "newsletter_settings", "1");
    return row;
  });

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await getEngineDb()
    .from("newsletter_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const saveCampaign = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        subject: z.string().min(1).max(300),
        html_body: z.string().max(500_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const db = getEngineDb();
    if (data.id) {
      const { data: row, error } = await db
        .from("newsletter_campaigns")
        .update({
          subject: data.subject,
          html_body: data.html_body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await db
      .from("newsletter_campaigns")
      .insert({
        subject: data.subject,
        html_body: data.html_body,
        status: "draft",
        created_by: actor.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "create", "newsletter_campaigns", row.id);
    return row;
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const db = getEngineDb();
    const { count } = await db
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed");
    const { data: row, error } = await db
      .from("newsletter_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: count ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "send", "newsletter_campaigns", data.id, {
      recipient_count: count ?? 0,
      simulated: true,
    });
    // SMTP not configured in this environment — campaign is marked sent with stored HTML.
    return { ...row, simulated: true as const };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb().from("newsletter_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "newsletter_campaigns", data.id);
    return { ok: true };
  });

/** Public subscribe — no admin session required. */
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        email: z.string().email().max(200),
        source: z.string().max(80).default("site"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { data: settings } = await getEngineDb().from("newsletter_settings").select("enabled").eq("id", 1).maybeSingle();
    if (settings && settings.enabled === false) throw new Error("Newsletter signup is currently disabled");

    const { error } = await getEngineDb().from("newsletter_subscribers").upsert(
      {
        email,
        source: data.source,
        status: "subscribed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribeByToken = createServerFn({ method: "POST" })
  .validator((data) => z.object({ token: z.string().min(10).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { data: row, error } = await getEngineDb()
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
      .eq("unsubscribe_token", data.token)
      .select("email")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invalid unsubscribe link");
    return { ok: true, email: row.email };
  });

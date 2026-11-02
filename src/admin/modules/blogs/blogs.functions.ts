import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { getEngineDb } from "@/engine/data/server-db";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export const listBlogsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await getEngineDb()
    .from("blogs")
    .select("*, admin_users(name)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getBlogAdmin = createServerFn({ method: "GET" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row, error } = await getEngineDb().from("blogs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveBlog = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(300),
        slug: z.string().max(160).optional(),
        excerpt: z.string().max(2000).default(""),
        content_html: z.string().max(2_000_000).default(""),
        cover_url: z.string().max(1000).nullable().optional(),
        status: z.enum(["draft", "published"]).default("draft"),
        sort_order: z.number().int().default(0),
        seo_title: z.string().max(300).nullable().optional(),
        seo_description: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const slug = (data.slug?.trim() || slugify(data.title)) || `post-${Date.now()}`;
    const payload = {
      title: data.title.trim(),
      slug,
      excerpt: data.excerpt,
      content_html: data.content_html,
      cover_url: data.cover_url || null,
      status: data.status,
      sort_order: data.sort_order,
      seo_title: data.seo_title || null,
      seo_description: data.seo_description || null,
      author_admin_id: actor.id,
      updated_at: new Date().toISOString(),
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };

    if (data.id) {
      const { data: row, error } = await getEngineDb()
        .from("blogs")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(actor.id, "update", "blogs", data.id);
      return row;
    }

    const { data: row, error } = await getEngineDb().from("blogs").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "create", "blogs", row.id);
    return row;
  });

export const deleteBlog = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb().from("blogs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "blogs", data.id);
    return { ok: true };
  });

export const reorderBlog = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid(), sort_order: z.number().int() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await getEngineDb()
      .from("blogs")
      .update({ sort_order: data.sort_order, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: published blogs for homepage / listing. */
export const listPublishedBlogs = createServerFn({ method: "GET" })
  .validator((data) => z.object({ limit: z.number().int().min(1).max(50).optional() }).optional().parse(data ?? {}))
  .handler(async ({ data }) => {
    const limit = data?.limit ?? 12;
    const { data: rows, error } = await getEngineDb()
      .from("blogs")
      .select("id, title, slug, excerpt, cover_url, published_at, sort_order, author_admin_id, admin_users(name)")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPublishedBlogBySlug = createServerFn({ method: "GET" })
  .validator((data) => z.object({ slug: z.string().min(1).max(160) }).parse(data))
  .handler(async ({ data }) => {
    const db = getEngineDb();
    const { data: row, error } = await db
      .from("blogs")
      .select("*, admin_users(name, email)")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Blog not found");

    // Fire-and-forget view increment (best-effort)
    const nextViews = (typeof row.view_count === "number" ? row.view_count : 0) + 1;
    void db.from("blogs").update({ view_count: nextViews }).eq("id", row.id);
    return { ...row, view_count: nextViews };
  });

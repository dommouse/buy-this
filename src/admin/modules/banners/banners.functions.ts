import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { getEngineDb } from "@/engine/data/server-db";

const bannerFields = z.object({
  title: z.string().max(200),
  description: z.string().max(2000),
  image_url: z.string().min(1).max(2000),
  link_url: z.string().max(500).default(""),
  cta_label: z.string().max(80).default(""),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

/** Save a cropped/compressed banner image under public/uploads/banners. */
export const uploadBannerImage = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        dataUrl: z.string().min(32).max(12_000_000),
        filename: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const match = data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Invalid image payload");
    const mime = match[1]!;
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(match[2]!, "base64");
    if (buffer.byteLength > 2_500_000) throw new Error("Processed image is too large");

    const dir = path.join(process.cwd(), "public", "uploads", "banners");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    const filePath = path.join(dir, name);
    await writeFile(filePath, buffer);
    const url = `/uploads/banners/${name}`;
    return { url, bytes: buffer.byteLength };
  });

export const listBannersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await getEngineDb()
    .from("home_banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const saveBanner = createServerFn({ method: "POST" })
  .validator((data) =>
    bannerFields
      .extend({ id: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { id, ...rest } = data;
    const payload = { ...rest, updated_at: new Date().toISOString() };
    if (id) {
      const { data: row, error } = await getEngineDb()
        .from("home_banners")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await audit(actor.id, "update", "home_banners", id);
      return row;
    }
    const { data: row, error } = await getEngineDb().from("home_banners").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "create", "home_banners", row.id);
    return row;
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb().from("home_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "home_banners", data.id);
    return { ok: true };
  });

/** Public active banners for homepage slider. */
export const listActiveBanners = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getEngineDb()
    .from("home_banners")
    .select("id, title, description, image_url, link_url, cta_label, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { hashPassword } from "@/admin/auth/password";
import { getEngineDb } from "@/engine/data/server-db";

const publicSelect = "id, name, email, is_active, email_verified_at, created_at, updated_at";

export const listPortalUsers = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        q: z.string().max(100).optional(),
        active: z.enum(["all", "active", "inactive"]).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = getEngineDb().from("portal_users").select(publicSelect).order("created_at", { ascending: false });
    if (data?.q?.trim()) {
      const term = `%${data.q.trim()}%`;
      q = q.or(`name.ilike.${term},email.ilike.${term}`);
    }
    if (data?.active === "active") q = q.eq("is_active", true);
    if (data?.active === "inactive") q = q.eq("is_active", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPortalUser = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        password: z.string().min(8).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const password_hash = await hashPassword(data.password);
    const { data: row, error } = await getEngineDb()
      .from("portal_users")
      .insert({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password_hash,
        is_active: true,
      })
      .select(publicSelect)
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "create", "portal_users", row.id);
    return row;
  });

export const updatePortalUser = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        is_active: z.boolean().optional(),
        password: z.string().min(8).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name != null) patch["name"] = data.name.trim();
    if (data.is_active != null) patch["is_active"] = data.is_active;
    if (data.password) patch["password_hash"] = await hashPassword(data.password);
    const { data: row, error } = await getEngineDb()
      .from("portal_users")
      .update(patch)
      .eq("id", data.id)
      .select(publicSelect)
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "update", "portal_users", data.id);
    return row;
  });

export const deletePortalUser = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const { error } = await getEngineDb().from("portal_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "portal_users", data.id);
    return { ok: true };
  });

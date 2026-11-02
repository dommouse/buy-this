import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { audit, requireAdmin } from "@/admin/auth/session.server";
import { hashPassword } from "@/admin/auth/password";
import { getEngineDb } from "@/engine/data/server-db";

const publicSelect = "id, name, email, role, is_active, last_login_at, created_at, updated_at";

export const listAdmins = createServerFn({ method: "GET" })
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
    let q = getEngineDb().from("admin_users").select(publicSelect).order("created_at", { ascending: false });
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

export const createAdmin = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        password: z.string().min(8).max(200),
        role: z.enum(["super", "admin"]).default("admin"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    if (data.role === "super" && actor.role !== "super") {
      throw new Error("Only super-admins can create super-admins");
    }
    const password_hash = await hashPassword(data.password);
    const { data: row, error } = await getEngineDb()
      .from("admin_users")
      .insert({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password_hash,
        role: data.role,
        is_active: true,
      })
      .select(publicSelect)
      .single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "create", "admin_users", row.id, { email: row.email });
    return row;
  });

export const updateAdmin = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        role: z.enum(["super", "admin"]).optional(),
        is_active: z.boolean().optional(),
        password: z.string().min(8).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    const db = getEngineDb();

    if (data.is_active === false || data.role === "admin") {
      const { data: target } = await db.from("admin_users").select("role, is_active").eq("id", data.id).single();
      if (target?.role === "super" && (data.is_active === false || data.role === "admin")) {
        const { count } = await db
          .from("admin_users")
          .select("id", { count: "exact", head: true })
          .eq("role", "super")
          .eq("is_active", true);
        if ((count ?? 0) <= 1) throw new Error("Cannot demote or deactivate the last active super-admin");
      }
    }

    if (data.id === actor.id && data.is_active === false) {
      throw new Error("You cannot deactivate your own account");
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name != null) patch["name"] = data.name.trim();
    if (data.role != null) {
      if (data.role === "super" && actor.role !== "super") throw new Error("Only super-admins can assign super role");
      patch["role"] = data.role;
    }
    if (data.is_active != null) patch["is_active"] = data.is_active;
    if (data.password) patch["password_hash"] = await hashPassword(data.password);

    const { data: row, error } = await db.from("admin_users").update(patch).eq("id", data.id).select(publicSelect).single();
    if (error) throw new Error(error.message);
    await audit(actor.id, "update", "admin_users", data.id, patch);
    return row;
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    if (data.id === actor.id) throw new Error("You cannot delete your own account");
    const db = getEngineDb();
    const { data: target } = await db.from("admin_users").select("role").eq("id", data.id).single();
    if (target?.role === "super") {
      const { count } = await db
        .from("admin_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "super")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) throw new Error("Cannot delete the last super-admin");
    }
    const { error } = await db.from("admin_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(actor.id, "delete", "admin_users", data.id);
    return { ok: true };
  });

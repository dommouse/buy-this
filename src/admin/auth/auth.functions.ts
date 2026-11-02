import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";

import { getEngineDb } from "@/engine/data/server-db";
import { hashPassword, verifyPassword } from "./password";
import {
  createAdminSession,
  destroyAdminSession,
  getCurrentAdmin,
  requireAdmin,
  type PublicAdmin,
} from "./session.server";

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { data: user, error } = await getEngineDb()
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!user || !user.is_active) throw new Error("Invalid email or password");
    const ok = await verifyPassword(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid email or password");
    await createAdminSession(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
    } satisfies PublicAdmin;
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  await destroyAdminSession();
  return { ok: true };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  return getCurrentAdmin();
});

/** Used by route beforeLoad — throws redirect when unauthenticated. */
export const requireAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw redirect({ to: "/admin/login", search: { redirect: "/admin" } });
  }
  return admin;
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        currentPassword: z.string().min(6).max(200),
        newPassword: z.string().min(8).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const { data: user } = await getEngineDb()
      .from("admin_users")
      .select("password_hash")
      .eq("id", admin.id)
      .single();
    if (!user) throw new Error("User not found");
    const ok = await verifyPassword(data.currentPassword, user.password_hash);
    if (!ok) throw new Error("Current password is incorrect");
    const password_hash = await hashPassword(data.newPassword);
    const { error } = await getEngineDb()
      .from("admin_users")
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq("id", admin.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOwnAdminProfile = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await requireAdmin();
  const { data: user, error } = await getEngineDb()
    .from("admin_users")
    .select("id, name, email, role, is_active, last_login_at, created_at, updated_at")
    .eq("id", admin.id)
    .single();
  if (error || !user) throw new Error(error?.message || "Profile not found");
  return user;
});

export const updateOwnAdminProfile = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        currentPassword: z.string().min(6).max(200).optional(),
        newPassword: z.string().min(8).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const db = getEngineDb();
    const email = data.email.trim().toLowerCase();
    const name = data.name.trim();

    const { data: existing, error: loadError } = await db
      .from("admin_users")
      .select("id, email, password_hash")
      .eq("id", admin.id)
      .single();
    if (loadError || !existing) throw new Error(loadError?.message || "User not found");

    if (email !== String(existing.email).toLowerCase()) {
      const { data: taken } = await db
        .from("admin_users")
        .select("id")
        .eq("email", email)
        .neq("id", admin.id)
        .maybeSingle();
      if (taken) throw new Error("That email is already registered to another admin account");
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      updated_at: new Date().toISOString(),
    };

    if (data.newPassword) {
      if (!data.currentPassword) throw new Error("Current password is required to set a new password");
      const ok = await verifyPassword(data.currentPassword, existing.password_hash);
      if (!ok) throw new Error("Current password is incorrect");
      payload["password_hash"] = await hashPassword(data.newPassword);
    }

    const { data: row, error } = await db
      .from("admin_users")
      .update(payload)
      .eq("id", admin.id)
      .select("id, name, email, role, is_active, last_login_at, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

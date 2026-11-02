import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/admin/auth/password";
import {
  createPortalSession,
  destroyPortalSession,
  getCurrentPortalUser,
} from "@/admin/auth/session.server";
import { getEngineDb } from "@/engine/data/server-db";

export const portalRegister = createServerFn({ method: "POST" })
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
    const email = data.email.trim().toLowerCase();
    const password_hash = await hashPassword(data.password);
    const { data: row, error } = await getEngineDb()
      .from("portal_users")
      .insert({
        name: data.name.trim(),
        email,
        password_hash,
        is_active: true,
      })
      .select("id, name, email, is_active")
      .single();
    if (error) {
      if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
        throw new Error("An account with that email already exists");
      }
      throw new Error(error.message);
    }
    await createPortalSession(row.id);
    return row;
  });

export const portalLogin = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        email: z.string().email().max(200),
        password: z.string().min(6).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { data: user } = await getEngineDb().from("portal_users").select("*").eq("email", email).maybeSingle();
    if (!user || !user.is_active) throw new Error("Invalid email or password");
    const ok = await verifyPassword(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid email or password");
    await createPortalSession(user.id);
    return { id: user.id, name: user.name, email: user.email, is_active: user.is_active };
  });

export const portalLogout = createServerFn({ method: "POST" }).handler(async () => {
  await destroyPortalSession();
  return { ok: true };
});

export const getPortalSession = createServerFn({ method: "GET" }).handler(async () => {
  return getCurrentPortalUser();
});

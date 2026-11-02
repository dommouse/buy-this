import { getEngineDb } from "@/engine/data/server-db";
import type { AdminUserRow, PortalUserRow } from "@/db/schema";
import {
  clearAdminSessionCookie,
  clearPortalSessionCookie,
  readAdminSessionCookie,
  readPortalSessionCookie,
  writeAdminSessionCookie,
  writePortalSessionCookie,
} from "./cookies";
import { createSessionToken, hashToken, sessionExpiryDate } from "./tokens";

export type PublicAdmin = Pick<AdminUserRow, "id" | "name" | "email" | "role" | "is_active" | "last_login_at">;
export type PublicPortalUser = Pick<PortalUserRow, "id" | "name" | "email" | "is_active">;

function db() {
  return getEngineDb();
}

export async function createAdminSession(adminUserId: string): Promise<void> {
  const token = createSessionToken();
  const expires = sessionExpiryDate(7);
  const { error } = await db().from("admin_sessions").insert({
    admin_user_id: adminUserId,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(error.message);
  await db()
    .from("admin_users")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", adminUserId);
  writeAdminSessionCookie(token, expires);
}

export async function destroyAdminSession(): Promise<void> {
  const token = readAdminSessionCookie();
  if (token) {
    await db().from("admin_sessions").delete().eq("token_hash", hashToken(token));
  }
  clearAdminSessionCookie();
}

export async function getCurrentAdmin(): Promise<PublicAdmin | null> {
  const token = readAdminSessionCookie();
  if (!token) return null;
  const { data: session } = await db()
    .from("admin_sessions")
    .select("id, admin_user_id, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db().from("admin_sessions").delete().eq("id", session.id);
    clearAdminSessionCookie();
    return null;
  }
  const { data: user } = await db()
    .from("admin_users")
    .select("id, name, email, role, is_active, last_login_at")
    .eq("id", session.admin_user_id)
    .maybeSingle();
  if (!user || !user.is_active) {
    clearAdminSessionCookie();
    return null;
  }
  return user as PublicAdmin;
}

export async function requireAdmin(): Promise<PublicAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}

export async function createPortalSession(portalUserId: string): Promise<void> {
  const token = createSessionToken();
  const expires = sessionExpiryDate(14);
  const { error } = await db().from("portal_sessions").insert({
    portal_user_id: portalUserId,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(error.message);
  writePortalSessionCookie(token, expires);
}

export async function destroyPortalSession(): Promise<void> {
  const token = readPortalSessionCookie();
  if (token) {
    await db().from("portal_sessions").delete().eq("token_hash", hashToken(token));
  }
  clearPortalSessionCookie();
}

export async function getCurrentPortalUser(): Promise<PublicPortalUser | null> {
  const token = readPortalSessionCookie();
  if (!token) return null;
  const { data: session } = await db()
    .from("portal_sessions")
    .select("id, portal_user_id, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db().from("portal_sessions").delete().eq("id", session.id);
    clearPortalSessionCookie();
    return null;
  }
  const { data: user } = await db()
    .from("portal_users")
    .select("id, name, email, is_active")
    .eq("id", session.portal_user_id)
    .maybeSingle();
  if (!user || !user.is_active) {
    clearPortalSessionCookie();
    return null;
  }
  return user as PublicPortalUser;
}

export async function audit(
  adminUserId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  payload: Record<string, unknown> = {},
) {
  await db().from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    entity,
    entity_id: entityId ?? null,
    payload,
  });
}

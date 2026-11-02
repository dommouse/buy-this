import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

export const ADMIN_SESSION_COOKIE = "bt_admin_session";
export const PORTAL_SESSION_COOKIE = "bt_portal_session";

const baseOpts = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env["NODE_ENV"] === "production",
};

export function readAdminSessionCookie(): string | undefined {
  return getCookie(ADMIN_SESSION_COOKIE);
}

export function writeAdminSessionCookie(token: string, expires: Date) {
  setCookie(ADMIN_SESSION_COOKIE, token, { ...baseOpts, expires });
}

export function clearAdminSessionCookie() {
  deleteCookie(ADMIN_SESSION_COOKIE, { path: "/" });
}

export function readPortalSessionCookie(): string | undefined {
  return getCookie(PORTAL_SESSION_COOKIE);
}

export function writePortalSessionCookie(token: string, expires: Date) {
  setCookie(PORTAL_SESSION_COOKIE, token, { ...baseOpts, expires });
}

export function clearPortalSessionCookie() {
  deleteCookie(PORTAL_SESSION_COOKIE, { path: "/" });
}

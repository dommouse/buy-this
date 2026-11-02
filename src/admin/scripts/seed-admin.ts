/**
 * Seed the first super-admin from env:
 *   ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD / ADMIN_BOOTSTRAP_NAME
 * Usage: npx tsx src/admin/scripts/seed-admin.ts
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { hashPassword } from "../auth/password";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) loadEnv({ path: envPath });

async function main() {
  const email = (process.env["ADMIN_BOOTSTRAP_EMAIL"] || "").trim().toLowerCase();
  const password = process.env["ADMIN_BOOTSTRAP_PASSWORD"] || "";
  const name = process.env["ADMIN_BOOTSTRAP_NAME"] || "Super Admin";
  const url = process.env["VITE_DB_URL"] || process.env["SUPABASE_URL"] || "";
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

  if (!email || !password) {
    throw new Error("Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in .env");
  }
  if (password.length < 8) throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters");
  if (!url || !key) throw new Error("Set VITE_DB_URL and SUPABASE_SERVICE_ROLE_KEY");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const password_hash = await hashPassword(password);

  const { data: existing } = await db.from("admin_users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    const { error } = await db
      .from("admin_users")
      .update({
        name,
        password_hash,
        role: "super",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    console.log(`Updated super-admin ${email}`);
    return;
  }

  const { error } = await db.from("admin_users").insert({
    name,
    email,
    password_hash,
    role: "super",
    is_active: true,
  });
  if (error) throw new Error(error.message);
  console.log(`Created super-admin ${email}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

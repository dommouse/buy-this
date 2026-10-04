import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { db } from "@/db/client";
import { dbConfig } from "@/db/utils/config";

/**
 * Prefer the service-role key for engine writes when provided.
 * Falls back to the shared publishable client (RLS policies in 0003 allow upserts).
 */
export function getEngineDb(): SupabaseClient {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (serviceKey) {
    return createClient(dbConfig.url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return db;
}

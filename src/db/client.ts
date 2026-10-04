import { createClient } from "@supabase/supabase-js";

import type { Database } from "./schema";
import { dbConfig } from "./utils/config";

// Browser-safe client. All access is protected by Row Level Security.
export const db = createClient<Database>(dbConfig.url, dbConfig.publishableKey);

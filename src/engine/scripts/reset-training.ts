/**
 * Wipe immature engine training data and start fresh:
 *   bun run engine:reset-training
 *
 * Requires DATABASE_URL / service role (same as migrations).
 * Applies pending migrations first if 0005 is not yet applied.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { serverDbConfig } from "../../db/utils/config";

const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) loadEnv({ path: envPath });

async function main() {
  const url = serverDbConfig().connectionString;
  if (!url) throw new Error("Fill DATABASE_URL or DB_PASSWORD in .env");

  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select public.engine_reset_training() as result`;
    console.log("engine_reset_training →", JSON.stringify(rows[0]?.["result"] ?? rows[0], null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

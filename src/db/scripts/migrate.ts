/**
 * Migration runner. Usage:
 *   bun run db:migrate            apply every pending file in src/db/migrations
 *   bun run db:new add_wishlist   create a new empty, numbered migration file
 *
 * Requires DATABASE_URL in `.env` (Supabase -> Project Settings -> Database ->
 * Connection string). Each file runs once, inside a transaction, and is
 * recorded in public._migrations so it is never applied twice.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { serverDbConfig } from "../utils/config";

// Bun/`--env-file` may already load this; keep a fallback for plain `tsx`.
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) loadEnv({ path: envPath });

const dir = join(process.cwd(), "src", "db", "migrations");
const files = () => readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

async function migrate() {
  const url = serverDbConfig().connectionString;
  if (!url) throw new Error("Fill DATABASE_URL or DB_PASSWORD in .env at the project root.");
  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists public._migrations (
      name text primary key, applied_at timestamptz not null default now())`;
    await sql`revoke all on public._migrations from anon, authenticated`;
    const done = new Set((await sql`select name from public._migrations`).map((r) => r["name"] as string));
    const pending = files().filter((f) => !done.has(f));
    if (!pending.length) return console.log("Database is up to date.");
    for (const file of pending) {
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(dir, file), "utf8"));
        await tx`insert into public._migrations (name) values (${file})`;
      });
      console.log(`Applied ${file}`);
    }
    await sql`notify pgrst, 'reload schema'`;
  } finally {
    await sql.end();
  }
}

function create(name: string | undefined) {
  if (!name) throw new Error("Give the migration a name, e.g. bun run db:new add_wishlist");
  const next = String(files().length + 1).padStart(4, "0");
  const file = `${next}_${name.replace(/\W+/g, "_").toLowerCase()}.sql`;
  writeFileSync(
    join(dir, file),
    "-- Remember: GRANT access + enable RLS + policies for every new table,\n-- then mirror changes in src/db/schema/index.ts\n",
  );
  console.log(`Created src/db/migrations/${file}`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === "new" ? Promise.resolve(create(arg)) : migrate()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

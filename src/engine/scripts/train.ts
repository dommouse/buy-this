/** Forces a training run now: bun run engine:train */
import { db } from "../../db/client";

const { data, error } = await (db as unknown as { rpc: (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> })
  .rpc("engine_train", { min_interval_minutes: 0 });
if (error) {
  console.error("Training failed:", error.message);
  process.exit(1);
}
console.log("Training result:", data);

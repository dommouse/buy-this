import { db } from "../client";
import type { Insert } from "../schema";

export async function createGiftSearch(values: Insert<"gift_searches">) {
  const { data, error } = await db.from("gift_searches").insert(values).select("id").single();
  if (error) throw error;
  return data.id;
}

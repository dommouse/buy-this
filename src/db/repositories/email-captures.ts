import { db } from "../client";
import type { Insert } from "../schema";

export async function createEmailCapture(values: Insert<"email_captures">) {
  const { error } = await db.from("email_captures").insert(values);
  if (error) throw error;
}

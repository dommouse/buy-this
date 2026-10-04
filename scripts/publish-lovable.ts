import { config } from "dotenv";

config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const rawKey = process.env.LOVABLE_API_KEY?.trim() || "";
const projectId = process.env.LOVABLE_PROJECT_ID?.trim() || "";
const version = process.env.LOVABLE_API_VERSION || "2026-09-11";

if (!rawKey) {
  console.error("Missing LOVABLE_API_KEY");
  process.exit(1);
}
if (!projectId || projectId === "your_project_id") {
  console.error("Missing LOVABLE_PROJECT_ID");
  process.exit(1);
}

const candidates = Array.from(
  new Set(
    [
      rawKey,
      rawKey.replace(/^Lov_/, "lov_"),
      rawKey.replace(/^LOV_/, "lov_"),
      rawKey.startsWith("lov_") ? rawKey : `lov_${rawKey.replace(/^lov_/i, "")}`,
    ].filter(Boolean),
  ),
);

async function request(path: string, apiKey: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    "Lovable-API-Key": apiKey,
    "Lovable-Version": version,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`https://api.lovable.dev${path}`, { ...init, headers });
  const text = await res.text();
  return { res, text };
}

async function main() {
  console.log("Project:", projectId);
  console.log("Trying", candidates.length, "API key variant(s)...");

  let workingKey: string | null = null;
  for (const apiKey of candidates) {
    const { res, text } = await request(`/v1/projects/${projectId}`, apiKey);
    console.log(`GET with prefix "${apiKey.slice(0, 4)}" → ${res.status}`);
    if (res.ok) {
      workingKey = apiKey;
      console.log("Project OK:", text.slice(0, 300));
      break;
    }
    console.log(text.slice(0, 250));
  }

  if (!workingKey) {
    console.error(
      "\nUnauthorized. Your LOVABLE_API_KEY was rejected by api.lovable.dev.\n" +
        "Create a workspace Access Token at https://lovable.dev/settings/api-keys\n" +
        "(Business/Enterprise, Projects: Read & write). Keys usually start with lov_\n" +
        "The gateway-style key used for AI may not work for publish.",
    );
    process.exit(1);
  }

  const { res: pubRes, text: pubText } = await request(`/v1/projects/${projectId}/publish`, workingKey, {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log("POST publish →", pubRes.status, pubText.slice(0, 500));
  if (pubRes.status !== 202 && pubRes.status !== 200) process.exit(1);

  const accepted = JSON.parse(pubText) as { id?: string; status?: string; url?: string | null };
  if (!accepted.id) {
    console.error("No deployment id");
    process.exit(1);
  }

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const { text } = await request(`/v1/projects/${projectId}/publish/${accepted.id}`, workingKey);
    const body = JSON.parse(text) as {
      status?: string;
      url?: string | null;
      error_message?: string | null;
    };
    console.log("poll:", body.status, body.url || "");
    if (body.status === "completed") {
      console.log("PUBLISHED_URL=", body.url);
      process.exit(0);
    }
    if (body.status === "error") {
      console.error("Publish failed:", body.error_message || text);
      process.exit(1);
    }
  }
  console.error("Timed out waiting for publish");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

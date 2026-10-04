import { config } from "dotenv";
config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const key = (process.env.LOVABLE_API_KEY || "").replace(/^Lov_/, "lov_");
const id = process.env.LOVABLE_PROJECT_ID || "";
const h = {
  "Lovable-API-Key": key,
  "Lovable-Version": "2026-09-11",
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function hit(method: string, path: string, body?: unknown) {
  const r = await fetch(`https://api.lovable.dev${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  console.log(`\n${method} ${path} → ${r.status}`);
  console.log(t.slice(0, 1200));
  return { status: r.status, text: t };
}

async function main() {
  await hit("GET", `/v1/git/files?project_id=${id}&ref=HEAD`);
  await hit("GET", `/v1/projects/${id}/edits?limit=5`);
  await hit("POST", `/v1/messages`, {
    project_id: id,
    message: "Reply with only OK if you can receive this API message. Do not change any files.",
  });
  await hit("POST", `/v1/project-files/upload-url`, {
    project_id: id,
    file_name: "sync-test.txt",
    content_type: "text/plain",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

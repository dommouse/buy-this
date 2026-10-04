import { config } from "dotenv";
config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const key = (process.env.LOVABLE_API_KEY || "").replace(/^Lov_/, "lov_");
const id = process.env.LOVABLE_PROJECT_ID || "";
const h = {
  "Lovable-API-Key": key,
  "Lovable-Version": "2026-09-11",
  Accept: "application/json",
};

async function main() {
  const endpoints = [
    `/v1/projects/${id}`,
    `/v1/projects/${id}/source`,
    `/v1/projects/${id}/git`,
    `/v1/projects/${id}/github`,
    `/v1/projects/${id}/repository`,
    `/v1/projects/${id}/files`,
  ];
  for (const path of endpoints) {
    const r = await fetch(`https://api.lovable.dev${path}`, { headers: h });
    const t = await r.text();
    console.log("\n===", path, r.status, "===");
    console.log(t.slice(0, 1500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

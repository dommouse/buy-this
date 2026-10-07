/**
 * Sync local code into the GitHub repo created by Lovable Git Sync, then publish.
 *
 * Prerequisites:
 * 1. In Lovable → Project settings → Git → connect GitHub (creates a new repo)
 * 2. Set LOVABLE_GITHUB_REPO_URL in .env (e.g. https://github.com/you/gift-perfector.git)
 * 3. Have git credentials that can push to that repo (gh auth / credential manager / PAT)
 *
 * Usage: npx tsx scripts/sync-to-lovable-github.ts
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const root = process.cwd();
const repoUrl = (process.env.LOVABLE_GITHUB_REPO_URL || "").trim();
const apiKey = (process.env.LOVABLE_API_KEY || "").replace(/^Lov_/, "lov_");
const projectId = (process.env.LOVABLE_PROJECT_ID || "").trim();
const version = process.env.LOVABLE_API_VERSION || "2026-09-11";

function run(cmd: string, args: string[], cwd: string) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmd} failed with ${r.status}`);
}

async function publish() {
  const headers = {
    "Lovable-API-Key": apiKey,
    "Lovable-Version": version,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const pubRes = await fetch(`https://api.lovable.dev/v1/projects/${projectId}/publish`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const pubText = await pubRes.text();
  console.log("publish:", pubRes.status, pubText.slice(0, 300));
  if (pubRes.status !== 202 && pubRes.status !== 200) throw new Error("publish failed");
  const accepted = JSON.parse(pubText) as { id: string };
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://api.lovable.dev/v1/projects/${projectId}/publish/${accepted.id}`, {
      headers,
    });
    const body = (await poll.json()) as { status?: string; url?: string; error_message?: string };
    console.log("poll:", body.status, body.url || "");
    if (body.status === "completed") {
      console.log("PUBLISHED_URL=", body.url);
      return;
    }
    if (body.status === "error") throw new Error(body.error_message || "publish error");
  }
  throw new Error("publish timed out");
}

async function main() {
  if (!repoUrl) {
    console.error(
      "Missing LOVABLE_GITHUB_REPO_URL.\n" +
        "1) Open https://lovable.dev/projects/" +
        projectId +
        "/settings/git\n" +
        "2) Connect GitHub (Lovable creates a NEW repo)\n" +
        "3) Paste the repo URL into .env as LOVABLE_GITHUB_REPO_URL=...\n" +
        "4) Re-run: npx tsx scripts/sync-to-lovable-github.ts",
    );
    process.exit(1);
  }
  if (!apiKey || !projectId) {
    console.error("Missing LOVABLE_API_KEY or LOVABLE_PROJECT_ID");
    process.exit(1);
  }

  const work = mkdtempSync(join(tmpdir(), "lovable-sync-"));
  console.log("Workdir:", work);
  try {
    run("git", ["clone", repoUrl, "repo"], work);
    const dest = join(work, "repo");

    // Copy local project over the cloned Lovable repo (keep its .git history).
    const skip = new Set([".git", "node_modules", "dist", ".output", ".env", ".vinxi", ".nitro", ".wrangler"]);
    for (const name of readdirSync(root)) {
      if (skip.has(name)) continue;
      const from = join(root, name);
      const to = join(dest, name);
      if (existsSync(to)) rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
    }

    // Ensure .env is never committed from local.
    writeFileSync(join(dest, ".env"), "# secrets stay in Lovable project settings / your local .env only\n");

    run("git", ["add", "-A"], dest);
    const status = spawnSync("git", ["status", "--porcelain"], { cwd: dest, encoding: "utf8", shell: true });
    if (!status.stdout?.trim()) {
      console.log("No file changes vs Lovable GitHub repo — skipping commit.");
    } else {
      run(
        "git",
        [
          "-c",
          "user.email=dev@local",
          "-c",
          "user.name=Local Sync",
          "commit",
          "-m",
          "Sync local AI engine, Amazon catalog, and results updates",
        ],
        dest,
      );
      run("git", ["push", "origin", "HEAD"], dest);
      console.log("Pushed to GitHub. Waiting 45s for Lovable to pull the sync...");
      await new Promise((r) => setTimeout(r, 45_000));
    }

    await publish();
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

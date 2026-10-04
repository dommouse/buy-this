// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Restart the dev server (and reload the page) whenever .env or db config changes.
const envWatcher = (): Plugin => ({
  name: "env-watcher",
  apply: "serve",
  configureServer(server) {
    const files = [".env", "src/db/utils/config.ts"].map((f) => `${server.config.root}/${f}`);
    server.watcher.add(files);
    server.watcher.on("change", (file) => {
      if (file.endsWith("/.env")) server.restart();
      else if (files.includes(file)) server.ws.send({ type: "full-reload" });
    });
  },
});

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { plugins: [envWatcher()] },
});

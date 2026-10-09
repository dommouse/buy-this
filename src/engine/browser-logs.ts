import type { EngineLogEntry } from "./types";

/**
 * Print engine logs in the browser DevTools console (production inspect).
 * Safe to call from client components — no Node APIs.
 */
export function printEngineLogsToConsole(
  logs: EngineLogEntry[] | undefined | null,
  meta?: { strategy?: string; modelVersion?: string },
) {
  if (typeof window === "undefined") return;
  if (!logs?.length) {
    console.log(
      "%c[BUY THIS engine]%c no engine logs on this response",
      "color:#c45c26;font-weight:bold",
      "color:inherit",
    );
    return;
  }

  const label = [
    "BUY THIS engine",
    meta?.strategy,
    meta?.modelVersion,
    `${logs.length} lines`,
  ]
    .filter(Boolean)
    .join(" · ");

  console.groupCollapsed(`%c[${label}]`, "color:#c45c26;font-weight:bold");
  for (const entry of logs) {
    const ts = new Date(entry.t).toISOString().slice(11, 23);
    const line = `${ts} ${entry.message}`;
    if (entry.level === "error") console.error(line);
    else if (entry.level === "warn") console.warn(line);
    else if (entry.level === "info") console.info(line);
    else console.log(line);
  }
  console.groupEnd();
}

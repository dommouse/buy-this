import type { EngineLogEntry } from "./types";

/** Print one engine log line to the browser console as soon as it arrives. */
export function printEngineLogLive(entry: EngineLogEntry) {
  if (typeof window === "undefined") return;
  const line = entry.message.startsWith("engine:") ? entry.message : `engine: ${entry.message}`;
  const withUi = entry.userMessage ? `${line}  →  ${entry.userMessage}` : line;
  if (entry.level === "error") console.error(withUi);
  else if (entry.level === "warn") console.warn(withUi);
  else if (entry.level === "info") console.info(withUi);
  else console.log(withUi);
}

/**
 * Print a full batch of engine logs (fallback if streaming isn't used).
 * Prefer printEngineLogLive during a streamed recommend run.
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

  const label = ["BUY THIS engine", meta?.strategy, meta?.modelVersion, `${logs.length} lines`]
    .filter(Boolean)
    .join(" · ");

  console.groupCollapsed(`%c[${label}]`, "color:#c45c26;font-weight:bold");
  for (const entry of logs) {
    printEngineLogLive(entry);
  }
  console.groupEnd();
}

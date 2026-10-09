import { AsyncLocalStorage } from "node:async_hooks";
import { toUserProgress } from "../progress-copy";
import type { EngineLogEntry } from "../types";

export type EngineLogLevel = EngineLogEntry["level"];
export type { EngineLogEntry };

type LogStore = {
  logs: EngineLogEntry[];
  onLog?: ((entry: EngineLogEntry) => void) | undefined;
};

const storage = new AsyncLocalStorage<LogStore>();

function formatArg(arg: unknown): string {
  if (arg == null) return String(arg);
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function formatMessage(args: unknown[]): string {
  return args.map(formatArg).join(" ");
}

function push(level: EngineLogLevel, args: unknown[]) {
  const message = formatMessage(args);
  const line = message.startsWith("engine:") ? message : `engine: ${message}`;
  const userMessage = toUserProgress(line);
  const entry: EngineLogEntry = {
    t: Date.now(),
    level,
    message: line,
    ...(userMessage ? { userMessage } : {}),
  };
  const store = storage.getStore();
  if (store) {
    store.logs.push(entry);
    try {
      store.onLog?.(entry);
    } catch {
      /* never break recommend on a bad listener */
    }
  }

  // Always mirror to the server process console as well.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "info") console.info(line);
  else console.log(line);
}

/** Info / general engine progress (shows as console.log in the browser). */
export function engineLog(...args: unknown[]) {
  push("log", args);
}

export function engineInfo(...args: unknown[]) {
  push("info", args);
}

export function engineWarn(...args: unknown[]) {
  push("warn", args);
}

export function engineError(...args: unknown[]) {
  push("error", args);
}

export type WithEngineLogsOptions = {
  /** Fired synchronously as each log is written (for streaming to the client). */
  onLog?: (entry: EngineLogEntry) => void;
};

/** Run a recommend pass while collecting every engineLog* call into a buffer. */
export async function withEngineLogs<T>(
  fn: () => Promise<T>,
  opts?: WithEngineLogsOptions,
): Promise<{ value: T; logs: EngineLogEntry[] }> {
  const store: LogStore = {
    logs: [],
    ...(opts?.onLog ? { onLog: opts.onLog } : {}),
  };
  const value = await storage.run(store, fn);
  return { value, logs: store.logs };
}

export function takeEngineLogs(): EngineLogEntry[] {
  return storage.getStore()?.logs ?? [];
}

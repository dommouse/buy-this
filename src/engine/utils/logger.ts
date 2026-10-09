import { AsyncLocalStorage } from "node:async_hooks";
import type { EngineLogEntry } from "../types";

export type EngineLogLevel = EngineLogEntry["level"];
export type { EngineLogEntry };

type LogStore = { logs: EngineLogEntry[] };

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
  const entry: EngineLogEntry = { t: Date.now(), level, message };
  const store = storage.getStore();
  if (store) store.logs.push(entry);

  // Always mirror to the server process console as well.
  const line = message.startsWith("engine:") ? message : `engine: ${message}`;
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

/** Run a recommend pass while collecting every engineLog* call into a buffer. */
export async function withEngineLogs<T>(fn: () => Promise<T>): Promise<{ value: T; logs: EngineLogEntry[] }> {
  const store: LogStore = { logs: [] };
  const value = await storage.run(store, fn);
  return { value, logs: store.logs };
}

export function takeEngineLogs(): EngineLogEntry[] {
  return storage.getStore()?.logs ?? [];
}

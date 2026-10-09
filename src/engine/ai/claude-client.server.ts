import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { engineConfig } from "../config";
import { engineWarn } from "../utils/logger";
import { isTlsCertError, recoverFromTlsError } from "../utils/tls";

export class AiUnavailableError extends Error {}

async function callClaudeOnce(system: string, prompt: string, signal: AbortSignal): Promise<string> {
  const anthropic = createAnthropic({ apiKey: engineConfig.anthropicApiKey });
  const result = await generateText({
    model: anthropic(engineConfig.claudeModel),
    system,
    prompt,
    maxRetries: 0,
    abortSignal: signal,
  });
  return result.text;
}

/** Shared Claude caller with timeout + TLS retry for local corporate proxies. */
export async function callClaude(system: string, prompt: string, timeoutMs = engineConfig.maxRecommendationMs): Promise<string> {
  if (!engineConfig.useAi || !engineConfig.anthropicApiKey) {
    throw new AiUnavailableError("Claude API key missing");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      return await callClaudeOnce(system, prompt, controller.signal);
    } catch (err) {
      if (recoverFromTlsError(err) && !controller.signal.aborted) {
        engineWarn("engine: retrying Claude after TLS relaxation");
        return await callClaudeOnce(system, prompt, controller.signal);
      }
      const status = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status;
      if (status === 401 || status === 402 || status === 403 || status === 429) {
        throw new AiUnavailableError(`Claude returned ${status}`);
      }
      if (isTlsCertError(err)) {
        throw new AiUnavailableError(
          "Claude TLS blocked (self-signed cert). Set ENGINE_TLS_INSECURE=true in local .env and restart.",
        );
      }
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

export function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

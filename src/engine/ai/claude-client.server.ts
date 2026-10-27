/**
 * Claude client retired — Gift Brain no longer calls Anthropic.
 * Kept as a stub so old imports resolve without spending API credits.
 */
export class AiUnavailableError extends Error {}

export async function callClaude(_system: string, _prompt: string, _timeoutMs?: number): Promise<string> {
  throw new AiUnavailableError("Claude is disabled — Gift Brain uses local search + scoring");
}

export function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

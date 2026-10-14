/**
 * Utility functions for network fetching, polling, and retry mechanisms.
 */

/**
 * Returns a poll interval with randomized jitter applied to prevent thundering herd problems.
 * @param baseIntervalMs Base interval in milliseconds (default: 300,000ms / 5 minutes)
 * @param maxJitterMs Maximum random jitter added to base interval in milliseconds (default: 30,000ms / 30 seconds)
 */
export function getJitteredPollInterval(baseIntervalMs: number = 300000, maxJitterMs: number = 30000): number {
  const jitter = Math.floor(Math.random() * maxJitterMs);
  return baseIntervalMs + jitter;
}

/**
 * Helper to execute fetch requests with a custom timeout.
 */
export async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

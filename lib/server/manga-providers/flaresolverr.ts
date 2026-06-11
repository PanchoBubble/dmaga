import "server-only";

import { env } from "@/lib/server/env";

/**
 * Fetches a Cloudflare-challenged page through FlareSolverr (already in the
 * Compose stack, riding the gluetun VPN netns — see docker-compose.yml). Used by
 * providers like VyManga whose series/chapter pages sit behind a "Just a
 * moment…" JS challenge that plain fetch can't clear. Mirrors the proven
 * `request.get` call in lib/server/indexers/fetch.ts, but takes a bare URL
 * instead of an IndexerConfig.
 *
 * Returns the solved page HTML, or throws — providers catch and degrade.
 */
type FlaresolverrResponse = {
  status?: string;
  message?: string;
  solution?: { response?: string };
};

export async function solveGet(url: string, timeoutMs = 30_000): Promise<string> {
  // Give FlareSolverr's own challenge solving headroom beyond our wait budget.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 10_000);

  try {
    const response = await fetch(env.FLARESOLVERR_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "request.get", url, maxTimeout: timeoutMs }),
    });

    if (!response.ok) {
      throw new Error(`FlareSolverr request failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as FlaresolverrResponse;
    if (payload.status !== "ok" || typeof payload.solution?.response !== "string") {
      throw new Error(
        `FlareSolverr could not solve ${url}: ${payload.message ?? "unknown error"}.`,
      );
    }

    return payload.solution.response;
  } finally {
    clearTimeout(timer);
  }
}

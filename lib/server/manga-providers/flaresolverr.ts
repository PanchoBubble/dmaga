import "server-only";

import { env } from "@/lib/server/env";

/**
 * Fetches a Cloudflare-challenged page through the manga Cloudflare solver
 * (byparr — see env.MANGA_SOLVER_URL). Used by providers like VyManga whose
 * series/chapter pages sit behind a Turnstile/managed challenge that plain fetch
 * (and FlareSolverr) can't clear. byparr exposes the FlareSolverr `/v1`
 * `request.get` API, so the call shape matches lib/server/indexers/fetch.ts.
 *
 * NOTE: the solver must run OFF the VPN — Cloudflare bans VPN exit IPs outright,
 * so a VPN-routed solve fails before it starts.
 *
 * Returns the solved page HTML, or throws — providers catch and degrade.
 */
type SolverResponse = {
  status?: string;
  message?: string;
  solution?: { response?: string };
};

export async function solveGet(url: string, timeoutMs = 45_000): Promise<string> {
  // Give the solver's own challenge solving headroom beyond our wait budget.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 15_000);

  try {
    const response = await fetch(env.MANGA_SOLVER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "request.get", url, maxTimeout: timeoutMs }),
    });

    if (!response.ok) {
      throw new Error(`Manga solver request failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as SolverResponse;
    if (payload.status !== "ok" || typeof payload.solution?.response !== "string") {
      throw new Error(
        `Manga solver could not solve ${url}: ${payload.message ?? "unknown error"}.`,
      );
    }

    return payload.solution.response;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new Error(`Manga solver timed out solving ${url}.`);
    }
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

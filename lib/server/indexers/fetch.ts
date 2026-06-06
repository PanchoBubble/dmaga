import { env } from "@/lib/server/env";
import { IndexerError, type IndexerConfig } from "@/lib/server/indexers/types";

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchOptions = {
  timeoutMs?: number;
  /** Cancels the request when the caller (e.g. a streaming search) aborts. */
  signal?: AbortSignal;
};

/** Aborts when either the timeout fires or the caller's signal aborts. */
function withTimeout(
  timeoutMs: number,
  signal: AbortSignal | undefined,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

/**
 * Fetches the raw text body for an indexer request, honoring the indexer's
 * configured fetch mode. `direct` uses plain HTTP; `flaresolverr` proxies the
 * request through a FlareSolverr instance to clear Cloudflare-style challenges.
 *
 * FlareSolverr is opt-in per indexer (never global) per the project plan.
 */
export async function fetchIndexerText(
  config: IndexerConfig,
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return config.fetchMode === "flaresolverr"
    ? fetchViaFlaresolverr(config, url, timeoutMs, options.signal)
    : fetchDirect(config, url, timeoutMs, options.signal);
}

async function fetchDirect(
  config: IndexerConfig,
  url: string,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<string> {
  const { signal, clear } = withTimeout(timeoutMs, callerSignal);

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        Accept:
          "application/rss+xml, application/xml, text/xml, application/json, text/html",
      },
    });

    if (!response.ok) {
      throw new IndexerError(`Indexer request failed with HTTP ${response.status}.`, {
        indexerId: config.id,
        indexerName: config.name,
      });
    }

    return await response.text();
  } catch (cause) {
    if (cause instanceof IndexerError) {
      throw cause;
    }

    const reason =
      cause instanceof Error && cause.name === "AbortError"
        ? `Indexer request timed out after ${timeoutMs}ms.`
        : "Indexer request failed.";

    throw new IndexerError(reason, {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  } finally {
    clear();
  }
}

type FlaresolverrResponse = {
  status?: string;
  message?: string;
  solution?: { response?: string };
};

async function fetchViaFlaresolverr(
  config: IndexerConfig,
  url: string,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<string> {
  // Give FlareSolverr's own challenge solving headroom beyond our wait budget.
  const { signal, clear } = withTimeout(timeoutMs + 5_000, callerSignal);

  try {
    const response = await fetch(env.FLARESOLVERR_URL, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url,
        maxTimeout: timeoutMs,
      }),
    });

    if (!response.ok) {
      throw new IndexerError(
        `FlareSolverr request failed with HTTP ${response.status}.`,
        { indexerId: config.id, indexerName: config.name },
      );
    }

    const payload = (await response.json()) as FlaresolverrResponse;

    if (payload.status !== "ok" || typeof payload.solution?.response !== "string") {
      throw new IndexerError(
        `FlareSolverr could not resolve the indexer request: ${payload.message ?? "unknown error"}.`,
        { indexerId: config.id, indexerName: config.name },
      );
    }

    return payload.solution.response;
  } catch (cause) {
    if (cause instanceof IndexerError) {
      throw cause;
    }

    const reason =
      cause instanceof Error && cause.name === "AbortError"
        ? `FlareSolverr request timed out after ${timeoutMs}ms.`
        : "FlareSolverr request failed.";

    throw new IndexerError(reason, {
      indexerId: config.id,
      indexerName: config.name,
      cause,
    });
  } finally {
    clear();
  }
}

import "server-only";

import { sql } from "drizzle-orm";
import { createClient } from "redis";

import { db } from "@/lib/db/client";
import type { RuntimeServiceId, RuntimeServiceTestResult } from "@/lib/services";
import { env } from "@/lib/server/env";

export async function testRuntimeService(
  id: RuntimeServiceId,
): Promise<RuntimeServiceTestResult> {
  try {
    if (id === "postgres") {
      await db.execute(sql`select 1`);
      return { id, ok: true, message: "Postgres query succeeded." };
    }

    if (id === "redis") {
      const client = createClient({ url: env.REDIS_URL });
      await client.connect();
      const pong = await client.ping();
      await client.disconnect();
      return { id, ok: pong === "PONG", message: `Redis replied ${pong}.` };
    }

    const healthUrl = new URL("/health", env.FLARESOLVERR_URL).toString();
    const response = await fetch(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        id,
        ok: false,
        message: `FlareSolverr returned HTTP ${response.status}.`,
      };
    }

    return { id, ok: true, message: "FlareSolverr health endpoint responded." };
  } catch (error) {
    return {
      id,
      ok: false,
      message: error instanceof Error ? error.message : "Service test failed.",
    };
  }
}

import { createClient } from "redis";

import { pollDueDebridItems, pollerConfig } from "@/lib/server/real-debrid/poller";

const intervalMs = Number(process.env.REAL_DEBRID_POLLER_INTERVAL_MS ?? 10_000);
const batchSize = Number(process.env.REAL_DEBRID_POLLER_BATCH_SIZE ?? 10);

const redis = createClient({ url: pollerConfig.redisUrl });
redis.on("error", (error) => {
  console.error("[real-debrid-poller] redis error", error);
});

let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

await redis.connect();
console.log("[real-debrid-poller] started");

while (!stopping) {
  try {
    const summary = await pollDueDebridItems({
      limit: batchSize,
      redis,
      lockTtlMs: Math.max(intervalMs * 3, 30_000),
    });

    if (summary.checked > 0) {
      console.log("[real-debrid-poller] poll", summary);
    }
  } catch (error) {
    console.error(
      "[real-debrid-poller] poll failed",
      error instanceof Error ? error.message : error,
    );
  }

  await sleep(intervalMs);
}

await redis.quit();
console.log("[real-debrid-poller] stopped");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

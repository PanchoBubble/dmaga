type RateLimiterOptions = {
  intervalMs: number;
  maxRequests: number;
};

export class RateLimiter {
  private queue: Array<() => void> = [];
  private timestamps: number[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: RateLimiterOptions) {}

  async waitForTurn() {
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.drain();
    });
  }

  private drain() {
    if (this.timer) {
      return;
    }

    const now = Date.now();
    this.timestamps = this.timestamps.filter(
      (timestamp) => now - timestamp < this.options.intervalMs,
    );

    while (this.queue.length > 0 && this.timestamps.length < this.options.maxRequests) {
      const resolve = this.queue.shift();
      this.timestamps.push(Date.now());
      resolve?.();
    }

    if (this.queue.length === 0) {
      return;
    }

    const oldestTimestamp = this.timestamps[0] ?? now;
    const waitMs = Math.max(1, this.options.intervalMs - (now - oldestTimestamp));

    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain();
    }, waitMs);
  }
}

export const realDebridRateLimiter = new RateLimiter({
  intervalMs: 60_000,
  maxRequests: 240,
});

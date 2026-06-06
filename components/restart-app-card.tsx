"use client";

import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Phase = "idle" | "confirming" | "restarting" | "error";

// The dev container also runs DB migrations on boot, so give it generous headroom.
const REJOIN_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 2_000;

export function RestartAppCard() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /**
   * Polls /api/health until the server has gone down and come back. We wait for
   * a failure first so a still-up server (the brief window before shutdown)
   * doesn't read as "already back".
   */
  const waitForRejoin = useCallback(() => {
    const startedAt = Date.now();
    let sawDowntime = false;

    const tick = async () => {
      if (Date.now() - startedAt > REJOIN_TIMEOUT_MS) {
        setPhase("error");
        setMessage(
          "The app is taking longer than expected to come back. Check the container, then reload.",
        );
        return;
      }

      let healthy = false;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        healthy = res.ok;
      } catch {
        healthy = false;
      }

      if (!healthy) {
        sawDowntime = true;
      } else if (sawDowntime) {
        // Back online after a restart — reload into the fresh server.
        window.location.reload();
        return;
      }

      timers.current.push(setTimeout(tick, POLL_INTERVAL_MS));
    };

    void tick();
  }, []);

  const restart = useCallback(async () => {
    setPhase("restarting");
    setMessage(null);
    try {
      const res = await fetch("/api/system/restart", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        restarting?: boolean;
        reason?: string;
      } | null;

      if (!res.ok || !data?.restarting) {
        setPhase("error");
        setMessage(data?.reason ?? "Restart request was rejected.");
        return;
      }

      waitForRejoin();
    } catch {
      // The server may have dropped the connection mid-restart — that's expected,
      // so fall through to polling rather than treating it as a hard failure.
      waitForRejoin();
    }
  }, [waitForRejoin]);

  return (
    <section className="border-2 border-foreground bg-card p-4 shadow-line">
      <h2 className="text-xl font-black">Runtime</h2>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-2 border-foreground bg-background p-3">
        <div>
          <p className="font-bold">Restart app</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Bounces the dev server to pick up config or env changes. Unavailable for
            ~40s.
          </p>
        </div>
        <Button onClick={() => setPhase("confirming")} variant="outline">
          <RotateCw className="size-4" />
          Restart
        </Button>
      </div>

      {phase === "restarting" ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Restarting and reconnecting…
        </p>
      ) : null}

      {phase === "error" ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-destructive">
          <AlertTriangle className="size-4" />
          {message}
        </p>
      ) : null}

      {phase === "confirming" ? (
        <ConfirmDialog
          onCancel={() => setPhase("idle")}
          onConfirm={() => void restart()}
        />
      ) : null}
    </section>
  );
}

function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      aria-labelledby="restart-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onCancel}
      role="dialog"
    >
      <div
        className="w-full max-w-sm border-2 border-foreground bg-card p-5 shadow-line"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-black" id="restart-dialog-title">
          Restart the app?
        </h3>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          The server will go down and come back automatically. Anyone using it will be
          disconnected for around 40 seconds.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            <RotateCw className="size-4" />
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
}

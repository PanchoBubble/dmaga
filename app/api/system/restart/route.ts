import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const dynamic = "force-dynamic";

// Give the HTTP response time to flush before we tear down the dev server.
const RESTART_DELAY_MS = 600;

/**
 * Restarts the app by terminating the `next` CLI process. Its parent (pnpm)
 * exits once the child dies, the container's init follows, and compose's
 * `restart: unless-stopped` policy brings everything back up — re-reading
 * next.config.ts, env, etc.
 *
 * We deliberately do NOT signal PID 1 directly: the kernel ignores signals sent
 * to a namespace's init process from within that namespace unless init installed
 * a handler, so killing the dev server is the reliable path. Note PID 1 is not
 * necessarily pnpm — podman injects `podman-init` as PID 1, making the tree
 * podman-init → pnpm → next, so we can't assume next is a direct child of PID 1.
 */
function inContainer(): boolean {
  return existsSync("/run/.containerenv") || existsSync("/.dockerenv");
}

function cmdlineOf(pid: number): string {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Processes running the Next CLI launcher (`next dev` / `next start`). We match
 * the launcher path specifically so we skip the `next-server` fork and the
 * `.next/dev/build` worker, and we scan the whole tree rather than only direct
 * children of PID 1 — under podman-init the launcher is a grandchild of PID 1.
 */
function devServerPids(): number[] {
  const pids: number[] = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid <= 1) continue;
    if (cmdlineOf(pid).includes("/next/dist/bin/next")) {
      pids.push(pid);
    }
  }
  return pids;
}

export function POST() {
  if (!inContainer()) {
    return NextResponse.json(
      {
        restarting: false,
        reason: "Not running in a container — refusing to signal host processes.",
      },
      { status: 409 },
    );
  }

  if (!/pnpm|next/.test(cmdlineOf(1))) {
    return NextResponse.json(
      {
        restarting: false,
        reason: "PID 1 is not the app supervisor — refusing to restart.",
      },
      { status: 409 },
    );
  }

  const targets = devServerPids();
  if (targets.length === 0) {
    return NextResponse.json(
      {
        restarting: false,
        reason: "Could not find the dev server process to restart.",
      },
      { status: 409 },
    );
  }

  // Respond first; terminate just after so the client gets a clean 200.
  setTimeout(() => {
    for (const pid of targets) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Process already gone — nothing to do.
      }
    }
  }, RESTART_DELAY_MS);

  return NextResponse.json({ restarting: true });
}

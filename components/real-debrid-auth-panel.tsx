"use client";

import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  PlugZap,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type AuthStatus =
  | { linked: false }
  | {
      linked: true;
      username?: string | null;
      accountId?: string | null;
      accessTokenExpiresAt?: string | null;
      lastAuthenticatedAt?: string | null;
      needsRefresh?: boolean;
    };

type DeviceCode = {
  device_code: string;
  user_code: string;
  interval: number;
  expires_in: number;
  verification_url: string;
};

type AuthStep = "idle" | "starting" | "waiting" | "linked" | "error";

export function RealDebridAuthPanel({ initialStatus }: { initialStatus: AuthStatus }) {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [deviceCode, setDeviceCode] = useState<DeviceCode | null>(null);
  const [step, setStep] = useState<AuthStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/auth/real-debrid/status", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to read Real-Debrid status.");
    }

    const nextStatus = (await response.json()) as AuthStatus;
    setStatus(nextStatus);

    if (nextStatus.linked) {
      setStep("linked");
    }
  }

  useEffect(() => {
    if (!deviceCode || step !== "waiting") {
      return;
    }

    const activeDeviceCode = deviceCode;
    let ignore = false;
    const intervalMs = Math.max(activeDeviceCode.interval, 5) * 1000;

    async function pollToken() {
      try {
        const response = await fetch("/api/auth/real-debrid/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: activeDeviceCode.device_code }),
        });
        const body = (await response.json()) as {
          linked?: boolean;
          error?: string;
          username?: string | null;
        };

        if (ignore) {
          return;
        }

        if (response.status === 202) {
          setError(null);
          return;
        }

        if (!response.ok || !body.linked) {
          throw new Error(body.error ?? "Unable to complete Real-Debrid auth.");
        }

        setStatus({
          linked: true,
          username: body.username,
        });
        setStep("linked");
        setDeviceCode(null);
        setError(null);
        await loadStatus();
      } catch (pollError) {
        if (!ignore) {
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Authorization check failed.",
          );
        }
      }
    }

    const timer = window.setInterval(() => {
      if (expiresAt && Date.now() >= expiresAt) {
        window.clearInterval(timer);
        setStep("error");
        setError("The Real-Debrid code expired. Start a new login to continue.");
        return;
      }

      void pollToken();
    }, intervalMs);

    void pollToken();

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [deviceCode, expiresAt, step]);

  async function startLogin() {
    setStep("starting");
    setError(null);

    try {
      const response = await fetch("/api/auth/real-debrid/device", {
        method: "POST",
      });
      const body = (await response.json()) as DeviceCode & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to start Real-Debrid auth.");
      }

      setDeviceCode(body);
      setExpiresAt(Date.now() + body.expires_in * 1000);
      setStep("waiting");
    } catch (loginError) {
      setStep("error");
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    }
  }

  async function copyCode() {
    if (!deviceCode) {
      return;
    }

    await navigator.clipboard.writeText(deviceCode.user_code);
  }

  return (
    <section className="border-2 border-foreground bg-card p-4 shadow-line">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-black">Real-Debrid</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Device login keeps tokens encrypted on this server for LAN devices.
          </p>
        </div>

        <Button
          disabled={step === "starting" || step === "waiting"}
          onClick={startLogin}
        >
          {step === "starting" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status.linked ? (
            <RotateCcw className="size-4" />
          ) : (
            <PlugZap className="size-4" />
          )}
          {status.linked ? "Relink" : "Link"}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="border-2 border-foreground bg-background p-3">
          <div className="flex items-center gap-2 font-black">
            {status.linked ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <PlugZap className="size-5" />
            )}
            {status.linked ? "Linked" : "Not linked"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.linked
              ? `${status.username ?? "Real-Debrid account"} is ready for torrents and downloads.`
              : "Start device login to connect this local app."}
          </p>
        </div>

        {status.linked && (
          <div className="border-2 border-foreground bg-secondary p-3 text-sm font-bold text-secondary-foreground">
            Token refresh: {status.needsRefresh ? "due" : "armed"}
          </div>
        )}
      </div>

      {deviceCode && step === "waiting" && (
        <div className="mt-5 grid gap-3 border-2 border-foreground bg-background p-4 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-black uppercase text-muted-foreground">Code</p>
            <p className="mt-1 text-4xl font-black tracking-normal">
              {deviceCode.user_code}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Expires in {deviceCode.expires_in} seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2 md:justify-end">
            <Button onClick={copyCode} variant="outline">
              <Copy className="size-4" />
              Copy
            </Button>
            <Button asChild>
              <a href={deviceCode.verification_url} rel="noreferrer" target="_blank">
                <ExternalLink className="size-4" />
                Open
              </a>
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 border-2 border-destructive bg-background p-3 text-sm font-bold text-destructive">
          {error}
        </div>
      )}
    </section>
  );
}

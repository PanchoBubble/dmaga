"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  PlugZap,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MyAnimeListAuthStatus } from "@/lib/myanimelist";

type AuthStep = "idle" | "starting" | "linked" | "error";

export function MyAnimeListAuthPanel({
  initialStatus,
}: {
  initialStatus: MyAnimeListAuthStatus;
}) {
  const [status, setStatus] = useState<MyAnimeListAuthStatus>(initialStatus);
  const [step, setStep] = useState<AuthStep>("idle");
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/auth/myanimelist/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      throw new Error("Unable to read MyAnimeList status.");
    }

    const nextStatus = (await response.json()) as MyAnimeListAuthStatus;
    setStatus(nextStatus);
    if (nextStatus.linked) {
      setStep("linked");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus().catch((statusError: unknown) => {
        setError(
          statusError instanceof Error ? statusError.message : "Status check failed.",
        );
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function startLogin() {
    setStep("starting");
    setError(null);

    try {
      const response = await fetch("/api/auth/myanimelist/start", {
        method: "POST",
      });
      const body = (await response.json()) as {
        authorizationUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.authorizationUrl) {
        throw new Error(body.error ?? "Unable to start MyAnimeList login.");
      }

      window.location.href = body.authorizationUrl;
    } catch (loginError) {
      setStep("error");
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    }
  }

  return (
    <section className="border-2 border-foreground bg-card p-4 shadow-line">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-black">MyAnimeList</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Link MAL to surface your anime list in Discover.
          </p>
        </div>

        <Button disabled={step === "starting"} onClick={startLogin}>
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
            ) : status.configured ? (
              <PlugZap className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
            {status.linked
              ? "Linked"
              : status.configured
                ? "Not linked"
                : "Missing API config"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.linked
              ? `${status.username ?? "MyAnimeList account"} is ready for anime sections.`
              : status.configured
                ? "Start OAuth login to connect your anime list."
                : "Set MYANIMELIST_CLIENT_ID and restart the app."}
          </p>
        </div>

        {status.linked ? (
          <div className="border-2 border-foreground bg-secondary p-3 text-sm font-bold text-secondary-foreground">
            Token refresh: {status.needsRefresh ? "due" : "armed"}
          </div>
        ) : (
          <Button asChild variant="outline">
            <a
              href="https://myanimelist.net/apiconfig"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-4" />
              API config
            </a>
          </Button>
        )}
      </div>

      {error ? (
        <div className="mt-4 border-2 border-destructive bg-background p-3 text-sm font-bold text-destructive">
          {error}
        </div>
      ) : null}
    </section>
  );
}

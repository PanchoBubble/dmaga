"use client";

import { AlertTriangle, CheckCircle2, Loader2, TestTube2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { RuntimeServiceId, RuntimeServiceTestResult } from "@/lib/services";
import { cn } from "@/lib/utils";

const services = [
  { id: "postgres", label: "Postgres" },
  { id: "redis", label: "Redis" },
  { id: "flaresolverr", label: "FlareSolverr" },
] as const satisfies Array<{ id: RuntimeServiceId; label: string }>;

export function ServiceTests() {
  const [testing, setTesting] = useState<RuntimeServiceId | null>(null);
  const [results, setResults] = useState<
    Partial<Record<RuntimeServiceId, RuntimeServiceTestResult>>
  >({});

  async function testService(id: RuntimeServiceId) {
    setTesting(id);

    try {
      const response = await fetch("/api/services/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as
        | RuntimeServiceTestResult
        | {
            error: string;
          };
      if (!response.ok || !("ok" in payload)) {
        throw new Error("error" in payload ? payload.error : "Service test failed.");
      }
      setResults((current) => ({ ...current, [id]: payload }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [id]: {
          id,
          ok: false,
          message: error instanceof Error ? error.message : "Service test failed.",
        },
      }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <section className="border-2 border-foreground bg-card p-4 shadow-line">
      <h2 className="text-xl font-black">Services</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {services.map((service) => {
          const result = results[service.id];
          const isTesting = testing === service.id;

          return (
            <div
              className="flex flex-col gap-3 border-2 border-foreground bg-background p-3"
              key={service.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{service.label}</span>
                <Button
                  disabled={Boolean(testing)}
                  onClick={() => void testService(service.id)}
                  size="sm"
                  variant="outline"
                >
                  {isTesting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <TestTube2 className="size-4" />
                  )}
                  Test
                </Button>
              </div>

              {result ? (
                <p
                  className={cn(
                    "flex items-start gap-2 text-xs font-bold",
                    result.ok ? "text-emerald-700" : "text-destructive",
                  )}
                >
                  {result.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  )}
                  {result.message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

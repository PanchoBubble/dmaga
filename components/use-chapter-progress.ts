"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  ChapterProgress,
  ProgressResponse,
  ProgressUpsert,
  SeriesProgress,
} from "@/lib/progress";

/**
 * Loads a series' reading progress (per-chapter read map + resume point) and
 * exposes an optimistic `markRead` toggle. Used by the chapter lists to show
 * read/unread ticks and a "Continue reading" jump.
 */
export function useChapterProgress(seriesKey: string | null) {
  const [units, setUnits] = useState<Record<string, ChapterProgress>>({});
  const [series, setSeries] = useState<SeriesProgress | null>(null);

  useEffect(() => {
    if (!seriesKey) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/manga/progress?seriesKey=${encodeURIComponent(seriesKey)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<ProgressResponse>) : null))
      .then((p) => {
        if (p) {
          setUnits(p.units);
          setSeries(p.series);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [seriesKey]);

  const markRead = useCallback(
    async (body: Omit<ProgressUpsert, "lastPage"> & { lastPage?: number }) => {
      // Optimistic: flip the tick immediately.
      setUnits((current) => ({
        ...current,
        [body.unitKey]: {
          unitKey: body.unitKey,
          completed: body.completed,
          lastPage: current[body.unitKey]?.lastPage ?? 0,
        },
      }));
      try {
        await fetch("/api/manga/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastPage: 0, ...body }),
        });
      } catch {
        // Best-effort; the next load reconciles.
      }
    },
    [],
  );

  return { units, series, markRead };
}

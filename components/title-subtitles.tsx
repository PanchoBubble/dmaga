"use client";

import { Download, ExternalLink, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SubtitleItem, SubtitleTarget } from "@/lib/subtitles";

type SubtitleState = {
  subtitles: SubtitleItem[];
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
};

const initialState: SubtitleState = {
  subtitles: [],
  status: "idle",
  error: null,
};

export function TitleSubtitles({ target }: { target: SubtitleTarget }) {
  const [state, setState] = useState<SubtitleState>(initialState);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");

  const key = `${target.type}|${target.imdbId}|${target.season ?? ""}|${target.episode ?? ""}`;

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      type: target.type,
      id: target.imdbId,
    });
    if (target.season != null) {
      params.set("season", String(target.season));
    }
    if (target.episode != null) {
      params.set("episode", String(target.episode));
    }

    void (async () => {
      setState({ ...initialState, status: "loading" });
      try {
        const response = await fetch(`/api/subtitles?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          subtitles?: SubtitleItem[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load subtitles.");
        }
        setState({
          subtitles: body.subtitles ?? [],
          status: "success",
          error: null,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setState({
          subtitles: [],
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load subtitles.",
        });
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const languages = useMemo(() => {
    const map = new Map<string, string>();
    for (const subtitle of state.subtitles) {
      map.set(subtitle.lang, subtitle.label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [state.subtitles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.subtitles.filter((subtitle) => {
      if (language !== "all" && subtitle.lang !== language) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        subtitle.label.toLowerCase().includes(needle) ||
        subtitle.lang.toLowerCase().includes(needle) ||
        subtitle.id.toLowerCase().includes(needle)
      );
    });
  }, [language, query, state.subtitles]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">
          Subtitles
          {state.subtitles.length ? (
            <span className="ml-2 text-sm font-bold text-muted-foreground">
              {state.subtitles.length}
            </span>
          ) : null}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-40 border-2 border-foreground bg-background pl-7 pr-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring sm:w-56"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subtitles"
              type="search"
              value={query}
            />
          </label>

          <select
            className="h-8 border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setLanguage(event.target.value)}
            value={language}
          >
            <option value="all">All languages</option>
            {languages.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 text-sm font-black shadow-line">
          <Loader2 className="size-4 animate-spin" />
          Loading subtitles
        </div>
      ) : null}

      {state.status === "error" ? (
        <Panel>{state.error ?? "Couldn’t load subtitles."}</Panel>
      ) : null}

      {state.status === "success" && filtered.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 60).map((subtitle) => (
            <li
              className="flex items-center justify-between gap-2 border-2 border-foreground bg-card p-2 shadow-line"
              key={`${subtitle.id}:${subtitle.url}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{subtitle.label}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {subtitle.source}
                  {subtitle.downloads != null ? ` · ${subtitle.downloads}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild className="size-8 p-0" size="icon" variant="outline">
                  <a href={subtitle.url} rel="noreferrer" target="_blank" title="Open">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button asChild className="size-8 p-0" size="icon" variant="secondary">
                  <a download href={subtitle.url} title="Download">
                    <Download className="size-3.5" />
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : state.status === "success" ? (
        <Panel>No subtitles matched.</Panel>
      ) : null}
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-6 text-center text-sm font-bold text-muted-foreground">
      {children}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Magnet,
  Star,
  Upload,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TorrentDetailsModal } from "@/components/torrent-details-modal";
import { Button } from "@/components/ui/button";
import { entryKey, useDebridStore } from "@/hooks/use-debrid-store";
import { useSavedStore } from "@/hooks/use-saved-store";
import {
  formatBytes,
  formatRelativeAge,
  isTorrentFileUrl,
  magnetLinkFor,
  type DebridAvailability,
  type SearchResultDto,
} from "@/lib/search";
import { cn } from "@/lib/utils";

type TorrentResultCardProps = {
  result: SearchResultDto;
  index?: number;
  mode?: "download" | "manga";
};

const availabilityBadge: Record<
  "downloading" | "saved",
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  downloading: {
    label: "Downloading",
    icon: Loader2,
    className: "bg-accent text-accent-foreground",
  },
  saved: {
    label: "Saved to Debrid",
    icon: ArrowDownToLine,
    className: "bg-background",
  },
};

export function TorrentResultCard({
  result,
  index = 0,
  mode = "download",
}: TorrentResultCardProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const entry = useDebridStore((state) => state.entries[entryKey(result)]);
  const addToDebrid = useDebridStore((state) => state.addToDebrid);
  const savedEntry = useSavedStore((state) => state.entries[entryKey(result)]);
  const toggleSaved = useSavedStore((state) => state.toggleSaved);

  // The store's optimistic state wins over the search-time snapshot.
  const isSaved = savedEntry?.saved ?? result.saved ?? false;
  const isSavePending = savedEntry?.pending ?? false;

  // The just-added state (from the store) wins over the search-time snapshot.
  const availability: DebridAvailability = entry?.availability ?? result.debridState;
  const isAdding = entry?.status === "adding";
  const isReady = availability === "ready";
  const magnetHref = magnetLinkFor(result);
  const canAdd = Boolean(magnetHref || isTorrentFileUrl(result.sourceUrl));

  const badge =
    availability === "downloading" || availability === "saved"
      ? availabilityBadge[availability]
      : null;

  async function handleAdd() {
    const response = await addToDebrid(result);
    // Refresh server components so the Added page + nav badge pick up the item.
    if (response) {
      router.refresh();
      if (mode === "manga" && response.primaryReadableLinkId) {
        router.push(`/reader/${response.primaryReadableLinkId}`);
      }
    }
  }

  async function handleToggleSaved() {
    await toggleSaved(result, isSaved);
    // Refresh server components so the Saved page + nav badge stay in sync.
    router.refresh();
  }

  const stats = [
    { label: "Size", value: formatBytes(result.sizeBytes) },
    { label: "Seeds", value: formatCount(result.seeders) },
    { label: "Peers", value: formatCount(result.leechers) },
    { label: "Age", value: formatRelativeAge(result.publishedAt) },
  ];

  return (
    <>
      <motion.article
        animate={{ opacity: 1, y: 0 }}
        aria-label={`View details for ${result.title}`}
        className="flex h-full min-w-0 cursor-pointer flex-col border-2 border-foreground bg-card p-3 shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        initial={{ opacity: 0, y: 8 }}
        onClick={() => setDetailsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setDetailsOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        transition={{ delay: Math.min(index, 8) * 0.05 }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                <Users className="size-3 shrink-0" />
                <span className="truncate">{result.indexerName}</span>
              </p>
              <h2 className="mt-1 line-clamp-2 break-words text-base font-black leading-tight sm:text-lg">
                {result.title}
              </h2>
            </div>
            <Button
              aria-label={isSaved ? "Remove from saved" : "Save torrent"}
              aria-pressed={isSaved}
              className="size-9 shrink-0"
              disabled={isSavePending}
              onClick={(event) => {
                event.stopPropagation();
                void handleToggleSaved();
              }}
              size="icon"
              variant="outline"
            >
              {isSavePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Star
                  className={cn("size-4", isSaved && "fill-yellow-400 text-yellow-400")}
                />
              )}
            </Button>
          </div>

          <dl className="mt-2.5 grid grid-cols-2 gap-1.5 text-sm font-semibold sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                className="min-w-0 border-2 border-foreground bg-background px-2 py-1"
                key={stat.label}
              >
                <dt className="text-[10px] uppercase text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="truncate tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {badge ? (
            <div
              className={cn(
                "mt-2.5 inline-flex w-fit max-w-full items-center gap-2 border-2 border-foreground px-2 py-0.5 text-xs font-black",
                badge.className,
              )}
            >
              <badge.icon
                className={cn(
                  "size-4 shrink-0",
                  availability === "downloading" && "animate-spin",
                )}
              />
              {badge.label}
              {availability === "downloading" && entry && entry.progress > 0
                ? ` · ${entry.progress}%`
                : null}
            </div>
          ) : null}

          {entry?.status === "error" ? (
            <p className="mt-2.5 break-words border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
              {entry.error ?? "Failed to add to Real-Debrid."}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
            {magnetHref ? (
              <Button
                asChild
                onClick={(event) => event.stopPropagation()}
                size="sm"
                variant="outline"
              >
                <a href={magnetHref}>
                  <Magnet className="size-4" />
                  Magnet
                </a>
              </Button>
            ) : null}
            {isReady ? (
              mode === "manga" ? (
                <Button
                  disabled={isAdding}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleAdd();
                  }}
                  size="sm"
                >
                  {isAdding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BookOpen className="size-4" />
                  )}
                  Read
                </Button>
              ) : (
                <Button onClick={(event) => event.stopPropagation()} size="sm">
                  <Download className="size-4" />
                  Download
                </Button>
              )
            ) : (
              <Button
                disabled={!canAdd || isAdding}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleAdd();
                }}
                size="sm"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    RD
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    {entry?.status === "error"
                      ? "Retry"
                      : mode === "manga"
                        ? "Read"
                        : "RD"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.article>
      {detailsOpen ? (
        <TorrentDetailsModal onClose={() => setDetailsOpen(false)} result={result} />
      ) : null}
    </>
  );
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

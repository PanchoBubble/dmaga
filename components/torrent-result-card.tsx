"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  Download,
  HardDriveDownload,
  Loader2,
  Magnet,
  Star,
  Upload,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    label: "Saved",
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
  const addToTorrent = useDebridStore((state) => state.addToTorrent);
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
  // The torrent (non-debrid) path needs a magnet or info hash to hand to
  // qBittorrent; a bare .torrent URL isn't supported there.
  const canAddTorrent = Boolean(magnetHref || result.infoHash);

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

  async function handleAddTorrent() {
    const response = await addToTorrent(result);
    // The torrent downloads in the background; the Added page tracks progress.
    if (response) {
      router.refresh();
    }
  }

  async function handleToggleSaved() {
    await toggleSaved(result, isSaved);
    // Refresh server components so the Saved page + nav badge stay in sync.
    router.refresh();
  }

  return (
    <>
      <motion.article
        animate={{ opacity: 1, y: 0 }}
        aria-label={`View details for ${result.title}`}
        className="flex min-w-0 cursor-pointer flex-col border-2 border-foreground bg-card p-2 shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
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
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {result.previewImageUrl ? (
            <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden border-2 border-foreground bg-muted sm:w-10">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="2.5rem"
                src={result.previewImageUrl}
                unoptimized
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-black leading-tight sm:text-base">
              {result.displayTitle ?? result.title}
            </h2>
            <p className="flex items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-[10px] font-bold uppercase text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1">
                <Users className="size-3 shrink-0" />
                <span className="truncate">{result.indexerName}</span>
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">
                {formatBytes(result.sizeBytes)}
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">
                ▲{formatCount(result.seeders)}
              </span>
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="hidden shrink-0 tabular-nums sm:inline">
                {formatRelativeAge(result.publishedAt)}
              </span>
            </p>
          </div>

          {badge ? (
            <span
              className={cn(
                "hidden shrink-0 items-center gap-1 border-2 border-foreground px-1.5 py-0.5 text-[10px] font-black sm:inline-flex",
                badge.className,
              )}
            >
              <badge.icon
                className={cn(
                  "size-3.5 shrink-0",
                  availability === "downloading" && "animate-spin",
                )}
              />
              {availability === "downloading" && entry
                ? `${entry.progress}%`
                : badge.label}
            </span>
          ) : null}

          <div className="flex shrink-0 items-center gap-1.5">
            {magnetHref ? (
              <Button
                aria-label="Magnet link"
                asChild
                className="size-9 shrink-0"
                onClick={(event) => event.stopPropagation()}
                size="icon"
                variant="outline"
              >
                <a href={magnetHref}>
                  <Magnet className="size-4" />
                </a>
              </Button>
            ) : null}

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
                  className={cn(
                    "size-4",
                    isSaved && "fill-yellow-400 text-yellow-400",
                  )}
                />
              )}
            </Button>

            {!isReady && !isAdding && canAddTorrent ? (
              <Button
                aria-label="Download via torrent (no Real-Debrid)"
                className="size-9 shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleAddTorrent();
                }}
                size="icon"
                variant="outline"
              >
                <HardDriveDownload className="size-4" />
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
                <Button
                  onClick={(event) => event.stopPropagation()}
                  size="sm"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Download</span>
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
                    {entry ? `${entry.progress}%` : "0%"}
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

        {entry?.status === "error" ? (
          <p className="mt-2 break-words border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
            {entry.error ?? "Failed to add to Real-Debrid."}
          </p>
        ) : null}
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

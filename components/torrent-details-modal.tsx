"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  Download,
  HardDriveDownload,
  Loader2,
  Magnet,
  Star,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

type TorrentDetailsModalProps = {
  result: SearchResultDto;
  onClose: () => void;
};

const availabilityBadge: Record<
  "ready" | "downloading" | "saved",
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ready: {
    label: "Ready on Debrid",
    icon: CheckCircle2,
    className: "bg-primary text-primary-foreground",
  },
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

/**
 * Full-detail view for a single torrent result. Mounted only while open by the
 * card, it reads live Debrid/saved state from the same stores so its actions
 * stay in sync with the inline card. Closes on Escape or backdrop click.
 */
export function TorrentDetailsModal({ result, onClose }: TorrentDetailsModalProps) {
  const router = useRouter();
  const entry = useDebridStore((state) => state.entries[entryKey(result)]);
  const addToDebrid = useDebridStore((state) => state.addToDebrid);
  const addToTorrent = useDebridStore((state) => state.addToTorrent);
  const savedEntry = useSavedStore((state) => state.entries[entryKey(result)]);
  const toggleSaved = useSavedStore((state) => state.toggleSaved);

  const isSaved = savedEntry?.saved ?? result.saved ?? false;
  const isSavePending = savedEntry?.pending ?? false;
  const availability: DebridAvailability = entry?.availability ?? result.debridState;
  const isAdding = entry?.status === "adding";
  const isReady = availability === "ready";
  const magnetHref = magnetLinkFor(result);
  const canAdd = Boolean(magnetHref || isTorrentFileUrl(result.sourceUrl));
  const canAddTorrent = Boolean(magnetHref || result.infoHash);
  const badge = availability !== "unknown" ? availabilityBadge[availability] : null;

  // Close on Escape, matching the indexer filter modal.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleAdd() {
    const response = await addToDebrid(result);
    if (response) {
      router.refresh();
    }
  }

  async function handleAddTorrent() {
    const response = await addToTorrent(result);
    if (response) {
      router.refresh();
    }
  }

  async function handleToggleSaved() {
    await toggleSaved(result, isSaved);
    router.refresh();
  }

  const stats = [
    { label: "Size", value: formatBytes(result.sizeBytes) },
    { label: "Seeds", value: formatCount(result.seeders) },
    { label: "Peers", value: formatCount(result.leechers) },
    { label: "Age", value: formatRelativeAge(result.publishedAt) },
  ];

  return (
    <div
      aria-labelledby="torrent-details-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-foreground/40"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />

      <div className="relative flex max-h-[85dvh] w-full max-w-lg flex-col border-2 border-foreground bg-card shadow-line">
        <div className="flex items-start justify-between gap-3 border-b-2 border-foreground p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {result.indexerName}
            </p>
            <h2
              className="mt-1 break-words text-lg font-black leading-tight"
              id="torrent-details-title"
            >
              {result.title}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center border-2 border-foreground bg-background shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {badge ? (
            <div
              className={cn(
                "inline-flex w-fit max-w-full items-center gap-2 border-2 border-foreground px-2 py-1 text-xs font-black",
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
              {availability === "downloading" && entry ? ` · ${entry.progress}%` : null}
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-2 text-sm font-semibold sm:grid-cols-4">
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

          {result.infoHash ? (
            <CopyField label="Info hash" value={result.infoHash} />
          ) : null}
          {result.magnetUrl ? (
            <CopyField label="Magnet" value={result.magnetUrl} mono />
          ) : null}

          {entry?.status === "error" ? (
            <p className="break-words border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
              {entry.error ?? "Failed to add to Real-Debrid."}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-foreground p-4">
          <Button
            aria-pressed={isSaved}
            disabled={isSavePending}
            onClick={() => void handleToggleSaved()}
            variant="outline"
          >
            {isSavePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Star
                className={cn("size-4", isSaved && "fill-yellow-400 text-yellow-400")}
              />
            )}
            {isSaved ? "Saved" : "Save"}
          </Button>
          {result.sourceUrl ? (
            <Button asChild variant="outline">
              <a href={result.sourceUrl} rel="noreferrer" target="_blank">
                Details
              </a>
            </Button>
          ) : null}
          {magnetHref ? (
            <Button asChild variant="outline">
              <a href={magnetHref}>
                <Magnet className="size-4" />
                Magnet
              </a>
            </Button>
          ) : null}
          {!isReady && !isAdding && canAddTorrent ? (
            <Button onClick={() => void handleAddTorrent()} variant="outline">
              <HardDriveDownload className="size-4" />
              Torrent
            </Button>
          ) : null}
          {isReady ? (
            <Button>
              <Download className="size-4" />
              Download
            </Button>
          ) : (
            <Button disabled={!canAdd || isAdding} onClick={() => void handleAdd()}>
              {isAdding ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {entry ? `${entry.progress}%` : "0%"}
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  {entry?.status === "error" ? "Retry" : "RD"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A labelled, read-only value with a copy-to-clipboard button. */
function CopyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / denied); leave the value visible.
    }
  }

  return (
    <div className="border-2 border-foreground bg-background">
      <div className="flex items-center justify-between gap-2 border-b-2 border-dashed border-foreground px-2 py-1">
        <span className="text-[10px] font-black uppercase text-muted-foreground">
          {label}
        </span>
        <button
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase hover:underline"
          onClick={() => void handleCopy()}
          type="button"
        >
          {copied ? <CheckCircle2 className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={cn("break-all px-2 py-1.5 text-xs", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}

function formatCount(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

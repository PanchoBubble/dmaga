"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Download,
  Loader2,
  MoreHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  debridStatusLabel,
  isActiveDebridStatus,
  type AddedItemDto,
  type AddedItemLinkDto,
} from "@/lib/debrid";
import { formatBytes, formatRelativeAge } from "@/lib/search";
import { cn } from "@/lib/utils";

type AddedItemCardProps = {
  item: AddedItemDto;
};

export function AddedItemCard({ item }: AddedItemCardProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingHostDownloadId, setPendingHostDownloadId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const isReady = item.status === "ready";
  const isActive = isActiveDebridStatus(item.status);
  const isRemoved = item.status === "deleted";
  const downloadLinks = item.links.filter(
    (link) => link.unrestrictedLink || link.originalLink,
  );

  async function runAction(action: "remove_local" | "delete_from_debrid") {
    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/debrid/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update item.");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update item.");
    } finally {
      setPendingAction(null);
    }
  }

  async function queueHostDownload(link: AddedItemLinkDto) {
    setPendingHostDownloadId(link.id);
    setError(null);

    try {
      const response = await fetch(`/api/debrid/links/${link.id}/host-download`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to queue host download.");
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to queue host download.",
      );
    } finally {
      setPendingHostDownloadId(null);
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col border-2 border-foreground bg-card p-3 shadow-line sm:p-4",
        isRemoved && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            {item.indexerName}
          </p>
          <h2 className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
            {item.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <StatusBadge item={item} />
          <details className="group relative">
            <summary
              aria-label="Added item actions"
              className="inline-flex size-10 cursor-pointer list-none items-center justify-center border-2 border-foreground bg-background text-foreground shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal className="size-5" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 border-2 border-foreground bg-popover p-1 shadow-line">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                disabled={Boolean(pendingAction) || isRemoved}
                onClick={() => void runAction("remove_local")}
                type="button"
              >
                {pendingAction === "remove_local" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                Remove locally
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                disabled={Boolean(pendingAction) || isRemoved || !item.torrentId}
                onClick={() => void runAction("delete_from_debrid")}
                type="button"
              >
                {pendingAction === "delete_from_debrid" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete from Real-Debrid
              </button>
            </div>
          </details>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold sm:mt-4">
        <div className="border-2 border-foreground bg-background px-2 py-1">
          <dt className="text-[10px] uppercase text-muted-foreground">Size</dt>
          <dd className="tabular-nums">{formatBytes(item.sizeBytes ?? undefined)}</dd>
        </div>
        <div className="border-2 border-foreground bg-background px-2 py-1">
          <dt className="text-[10px] uppercase text-muted-foreground">Added</dt>
          <dd className="tabular-nums">
            {formatRelativeAge(item.addedAt ?? undefined)}
          </dd>
        </div>
      </dl>

      {isActive ? (
        <div
          className="mt-3 h-2 w-full border-2 border-foreground bg-background"
          aria-label={`Download progress: ${item.progress}%`}
        >
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      ) : null}

      {item.errorMessage || error ? (
        <p className="mt-3 border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
          {error ?? item.errorMessage}
        </p>
      ) : null}

      {isReady && downloadLinks.length ? (
        <div className="mt-3 space-y-2">
          {downloadLinks.slice(0, 3).map((link) => (
            <div className="w-full justify-between px-3" key={link.id}>
              <Button asChild className="w-full justify-between px-3" variant="outline">
                <a
                  href={link.unrestrictedLink ?? link.originalLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">{link.fileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(link.fileSizeBytes ?? undefined)}
                  </span>
                </a>
              </Button>
              {link.hostDownload ? (
                <p className="mt-1 text-xs font-bold text-muted-foreground">
                  Host download: {hostDownloadLabel(link)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        <Button
          disabled={!isReady || !downloadLinks.length || Boolean(pendingHostDownloadId)}
          onClick={() => {
            if (downloadLinks[0]) {
              void queueHostDownload(downloadLinks[0]);
            }
          }}
          variant="outline"
        >
          <ArrowDownToLine className="size-4" />
          {pendingHostDownloadId ? "Queueing" : "Host download"}
        </Button>
        {isReady && downloadLinks.length ? (
          <Button asChild>
            <a
              href={downloadLinks[0].unrestrictedLink ?? downloadLinks[0].originalLink}
              rel="noreferrer"
              target="_blank"
            >
              <Download className="size-4" />
              Open link
            </a>
          </Button>
        ) : (
          <Button disabled>{debridStatusLabel(item.status)}</Button>
        )}
      </div>
    </article>
  );
}

function hostDownloadLabel(link: AddedItemLinkDto) {
  const download = link.hostDownload;
  if (!download) {
    return "Not queued";
  }

  if (download.status === "complete") {
    return `Complete (${formatBytes(download.bytesDownloaded)})`;
  }
  if (download.status === "error") {
    return download.errorMessage ?? "Error";
  }
  return download.status[0].toUpperCase() + download.status.slice(1);
}

function StatusBadge({ item }: { item: AddedItemDto }) {
  const isActive = isActiveDebridStatus(item.status);

  const tone = cn(
    "inline-flex w-fit items-center gap-2 border-2 border-foreground px-2 py-1 text-xs font-black",
    item.status === "ready" && "bg-secondary text-secondary-foreground",
    item.status === "error" && "bg-destructive text-destructive-foreground",
    isActive && "bg-accent text-accent-foreground",
  );

  const Icon =
    item.status === "ready"
      ? CheckCircle2
      : item.status === "error"
        ? AlertTriangle
        : isActive
          ? Loader2
          : ArrowDownToLine;

  return (
    <span className={tone}>
      <Icon className={cn("size-4", isActive && "animate-spin")} />
      {debridStatusLabel(item.status)}
    </span>
  );
}

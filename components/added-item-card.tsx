"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  MoreHorizontal,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import { Button } from "@/components/ui/button";
import {
  debridStatusLabel,
  isActiveDebridStatus,
  type AddedItemDto,
  type AddedItemLinkDto,
} from "@/lib/debrid";
import { isReadableMangaFile } from "@/lib/manga";
import { classifyPlayback, type PlaybackKind } from "@/lib/playback";
import { formatBytes, formatRelativeAge } from "@/lib/search";
import { cn } from "@/lib/utils";

type AddedItemCardProps = {
  item: AddedItemDto;
};

/**
 * Shared mutation + menu state for an added item, consumed by both the full
 * {@link AddedItemCard} and the slim {@link AddedItemRow} so the two layouts
 * stay behaviourally identical.
 */
function useAddedItemActions(item: AddedItemDto) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingHostDownloadId, setPendingHostDownloadId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // Tracked so the open card can lift into its own stacking context — otherwise
  // the next card (a later grid item) paints over the dropdown menu.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function runAction(
    action: "remove_local" | "delete_from_debrid" | "resolve_links",
  ) {
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

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return {
    pendingAction,
    pendingHostDownloadId,
    error,
    menuOpen,
    setMenuOpen,
    menuRef,
    runAction,
    queueHostDownload,
  };
}

function downloadableLinks(item: AddedItemDto): AddedItemLinkDto[] {
  return item.links.filter((link) => link.unrestrictedLink || link.originalLink);
}

export function AddedItemCard({ item }: AddedItemCardProps) {
  const {
    pendingAction,
    pendingHostDownloadId,
    error,
    menuOpen,
    setMenuOpen,
    menuRef,
    runAction,
    queueHostDownload,
  } = useAddedItemActions(item);
  const isReady = item.status === "ready";
  const isActive = isActiveDebridStatus(item.status);
  const isRemoved = item.status === "deleted";
  const downloadLinks = downloadableLinks(item);

  return (
    <article
      className={cn(
        "flex min-w-0 max-w-full flex-col overflow-hidden border-2 border-foreground bg-card p-3 shadow-line sm:p-4",
        isRemoved && "opacity-70",
        menuOpen && "relative z-40",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex min-w-0 gap-3">
          {item.previewImageUrl ? (
            <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden border-2 border-foreground bg-muted sm:w-16">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="4rem"
                src={item.previewImageUrl}
                unoptimized
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {item.indexerName} · {originSectionLabel(item.originSection)}
              {providerLabel(item.provider) ? (
                <span className="ml-1.5 border-2 border-foreground bg-accent px-1 py-0.5 text-[9px] text-accent-foreground">
                  {providerLabel(item.provider)}
                </span>
              ) : null}
            </p>
            <h2 className="mt-2 break-words text-lg font-black leading-tight sm:text-xl">
              {item.title}
            </h2>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:ml-auto lg:w-[28rem] lg:shrink-0">
          <div className="flex items-start justify-between gap-2">
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-2 text-sm font-semibold">
              <div className="border-2 border-foreground bg-background px-2 py-1">
                <dt className="text-[10px] uppercase text-muted-foreground">Size</dt>
                <dd className="tabular-nums">
                  {formatBytes(item.sizeBytes ?? undefined)}
                </dd>
              </div>
              <div className="border-2 border-foreground bg-background px-2 py-1">
                <dt className="text-[10px] uppercase text-muted-foreground">Added</dt>
                <dd className="tabular-nums">
                  {formatRelativeAge(item.addedAt ?? undefined)}
                </dd>
              </div>
            </dl>
            <StatusBadge item={item} />
            <ActionsMenu
              downloadLinks={downloadLinks}
              isReady={isReady}
              isRemoved={isRemoved}
              item={item}
              menuOpen={menuOpen}
              menuRef={menuRef}
              pendingAction={pendingAction}
              pendingHostDownloadId={pendingHostDownloadId}
              queueHostDownload={queueHostDownload}
              runAction={runAction}
              setMenuOpen={setMenuOpen}
            />
          </div>

          {isActive ? null : (
            <ItemActionButtons
              downloadLinks={downloadLinks}
              isReady={isReady}
              item={item}
              pendingAction={pendingAction}
              runAction={runAction}
            />
          )}
        </div>
      </div>

      {isActive ? <ItemProgressPanel className="mt-3" item={item} /> : null}

      {item.errorMessage || error ? (
        <p className="mt-3 border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
          {error ?? item.errorMessage}
        </p>
      ) : null}

      {isReady && downloadLinks.length ? (
        <ItemFilesList className="mt-3" downloadLinks={downloadLinks} />
      ) : null}
    </article>
  );
}

/**
 * Space-efficient alternative to {@link AddedItemCard}: a single-line header
 * (thumb, title, status, actions) that expands to reveal the same files and
 * download/play actions — mirroring the show → episode → sources drilldown.
 */
export function AddedItemRow({ item }: AddedItemCardProps) {
  const {
    pendingAction,
    pendingHostDownloadId,
    error,
    menuOpen,
    setMenuOpen,
    menuRef,
    runAction,
    queueHostDownload,
  } = useAddedItemActions(item);
  const [expanded, setExpanded] = useState(false);
  const isReady = item.status === "ready";
  const isActive = isActiveDebridStatus(item.status);
  const isRemoved = item.status === "deleted";
  const downloadLinks = downloadableLinks(item);
  const detailsId = `added-row-${item.id}`;

  return (
    <div
      className={cn(
        "min-w-0 border-2 border-foreground bg-card shadow-line",
        isRemoved && "opacity-70",
        menuOpen && "relative z-40",
      )}
    >
      <div className="flex items-center gap-2 p-2 sm:gap-3 sm:px-3">
        <button
          aria-controls={detailsId}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
          onClick={() => setExpanded((open) => !open)}
          type="button"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          {item.previewImageUrl ? (
            <div className="relative aspect-[2/3] w-8 shrink-0 overflow-hidden border-2 border-foreground bg-muted">
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="2rem"
                src={item.previewImageUrl}
                unoptimized
              />
            </div>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black leading-tight">
              {item.title}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase text-muted-foreground">
              {item.indexerName} · {originSectionLabel(item.originSection)}
            </span>
          </span>
        </button>

        <span className="hidden shrink-0 whitespace-nowrap text-right text-[11px] font-semibold tabular-nums text-muted-foreground sm:block">
          <span className="block">{formatBytes(item.sizeBytes ?? undefined)}</span>
          <span className="block">{formatRelativeAge(item.addedAt ?? undefined)}</span>
        </span>

        <StatusBadge item={item} size="sm" />
        <ActionsMenu
          downloadLinks={downloadLinks}
          isReady={isReady}
          isRemoved={isRemoved}
          item={item}
          menuOpen={menuOpen}
          menuRef={menuRef}
          pendingAction={pendingAction}
          pendingHostDownloadId={pendingHostDownloadId}
          queueHostDownload={queueHostDownload}
          runAction={runAction}
          setMenuOpen={setMenuOpen}
          size="sm"
        />
      </div>

      {isActive ? <ProgressBar progress={item.progress} /> : null}

      {expanded ? (
        <div className="space-y-3 border-t-2 border-foreground p-2 sm:p-3" id={detailsId}>
          {item.errorMessage || error ? (
            <p className="border-2 border-destructive bg-background px-2 py-1 text-xs font-bold text-destructive">
              {error ?? item.errorMessage}
            </p>
          ) : null}
          {isActive ? (
            <ItemProgressPanel item={item} />
          ) : (
            <ItemActionButtons
              downloadLinks={downloadLinks}
              isReady={isReady}
              item={item}
              pendingAction={pendingAction}
              runAction={runAction}
            />
          )}
          {isReady && downloadLinks.length ? (
            <ItemFilesList downloadLinks={downloadLinks} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const ORIGIN_SECTION_LABELS: Record<AddedItemDto["originSection"], string> = {
  movie: "Movie",
  show: "Show",
  mal: "MAL",
  manga: "Manga",
  other: "Other",
};

function originSectionLabel(section: AddedItemDto["originSection"]): string {
  return ORIGIN_SECTION_LABELS[section];
}

/** Short tag for non-Real-Debrid delivery, or null for the default RD path. */
function providerLabel(provider: AddedItemDto["provider"]): string | null {
  if (provider === "torrent") {
    return "Torrent";
  }
  if (provider === "direct") {
    return "Direct";
  }
  return null;
}

/** Primary Download / Play / Read buttons shared by the card and row layouts. */
function ItemActionButtons({
  downloadLinks,
  isReady,
  item,
  pendingAction,
  runAction,
}: {
  downloadLinks: AddedItemLinkDto[];
  isReady: boolean;
  item: AddedItemDto;
  pendingAction: string | null;
  runAction: (
    action: "remove_local" | "delete_from_debrid" | "resolve_links",
  ) => Promise<void>;
}) {
  const primaryStreamLink = downloadLinks.find((link) => link.streamable);
  const primaryReadableLink = downloadLinks.find((link) =>
    isReadableMangaFile(link.fileName),
  );

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {!isReady ? (
        <Button disabled>{debridStatusLabel(item.status)}</Button>
      ) : downloadLinks.length ? (
        <Button asChild variant="outline">
          <a
            href={`/api/debrid/links/${downloadLinks[0].id}/download`}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="size-4" />
            Download
          </a>
        </Button>
      ) : (
        // Ready but links not resolved yet — pull them from Real-Debrid, then
        // the file rows and per-file Download/Play appear on refresh.
        <Button
          disabled={Boolean(pendingAction)}
          onClick={() => void runAction("resolve_links")}
          variant="outline"
        >
          {pendingAction === "resolve_links" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {pendingAction === "resolve_links" ? "Loading" : "Download"}
        </Button>
      )}
      {isReady && primaryStreamLink ? (
        <Button asChild>
          <Link href={`/player/${primaryStreamLink.id}`}>
            <Play className="size-4" />
            Play
          </Link>
        </Button>
      ) : null}
      {isReady && primaryReadableLink ? (
        <Button asChild>
          <Link href={`/reader/${primaryReadableLink.id}`}>
            <BookOpen className="size-4" />
            Read
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/** The "Files (N)" pack list shared by the card and row layouts. */
function ItemFilesList({
  className,
  downloadLinks,
}: {
  className?: string;
  downloadLinks: AddedItemLinkDto[];
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">
        Files ({downloadLinks.length})
      </p>
      <div
        className={cn(
          "min-w-0 space-y-2",
          downloadLinks.length > 4 &&
            "max-h-64 overflow-y-auto border-2 border-foreground bg-background p-2",
        )}
      >
        {sortPackFiles(downloadLinks).map((link) => (
          <PackFileRow key={link.id} link={link} />
        ))}
      </div>
    </div>
  );
}

/**
 * Detailed progress block for an active (still-downloading) item: the status
 * label, the live percentage, and the bar. Shown in the expanded row body and
 * the card body so an in-flight item reads as "working", not an empty panel
 * with a lone disabled button.
 */
function ItemProgressPanel({
  className,
  item,
}: {
  className?: string;
  item: AddedItemDto;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-black uppercase">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {debridStatusLabel(item.status)}
        </span>
        <span className="tabular-nums">{item.progress}%</span>
      </div>
      <ProgressBar progress={item.progress} />
    </div>
  );
}

function ProgressBar({
  className,
  progress,
}: {
  className?: string;
  progress: number;
}) {
  return (
    <div
      className={cn("h-2 w-full border-2 border-foreground bg-background", className)}
      aria-label={`Download progress: ${progress}%`}
    >
      <div
        className="h-full bg-accent transition-[width]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function ActionsMenu({
  downloadLinks,
  isReady,
  isRemoved,
  item,
  menuOpen,
  menuRef,
  pendingAction,
  pendingHostDownloadId,
  queueHostDownload,
  runAction,
  setMenuOpen,
  size = "default",
}: {
  downloadLinks: AddedItemLinkDto[];
  isReady: boolean;
  isRemoved: boolean;
  item: AddedItemDto;
  menuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  pendingAction: string | null;
  pendingHostDownloadId: string | null;
  queueHostDownload: (link: AddedItemLinkDto) => Promise<void>;
  runAction: (
    action: "remove_local" | "delete_from_debrid" | "resolve_links",
  ) => Promise<void>;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  size?: "sm" | "default";
}) {
  const isSm = size === "sm";
  const isTorrent = item.provider === "torrent";
  // Torrent items are deleted via qBittorrent (info hash), so they don't need a
  // Real-Debrid torrent id; direct items have nothing remote to delete.
  const showDestructiveDelete = isTorrent || item.provider === "real_debrid";
  const canDelete = isTorrent || Boolean(item.torrentId);
  const deleteLabel = isTorrent ? "Delete & free space" : "Delete from Real-Debrid";

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        aria-label="Added item actions"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className={cn(
          "inline-flex cursor-pointer list-none items-center justify-center border-2 border-foreground bg-background text-foreground shadow-line transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
          isSm ? "size-8" : "size-10",
        )}
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        <MoreHorizontal className={isSm ? "size-4" : "size-5"} />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-0 z-50 mt-2 w-56 border-2 border-foreground bg-popover p-1 shadow-line"
          role="menu"
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            disabled={
              !isReady || !downloadLinks.length || Boolean(pendingHostDownloadId)
            }
            onClick={() => {
              setMenuOpen(false);
              if (downloadLinks[0]) {
                void queueHostDownload(downloadLinks[0]);
              }
            }}
            role="menuitem"
            type="button"
          >
            {pendingHostDownloadId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="size-4" />
            )}
            {pendingHostDownloadId ? "Queueing host download" : "Host download"}
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            disabled={Boolean(pendingAction) || isRemoved}
            onClick={() => {
              setMenuOpen(false);
              void runAction("remove_local");
            }}
            role="menuitem"
            type="button"
          >
            {pendingAction === "remove_local" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Remove from Added
          </button>
          {showDestructiveDelete ? (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              disabled={Boolean(pendingAction) || isRemoved || !canDelete}
              onClick={() => {
                setMenuOpen(false);
                void runAction("delete_from_debrid");
              }}
              role="menuitem"
              type="button"
            >
              {pendingAction === "delete_from_debrid" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleteLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Display rank per kind so playable media floats above subtitles/other files. */
const KIND_RANK: Record<PlaybackKind, number> = {
  video: 0,
  audio: 1,
  subtitle: 2,
  other: 3,
};

/** Orders a pack's files by kind (playable first), then by natural file name. */
function sortPackFiles(links: AddedItemLinkDto[]): AddedItemLinkDto[] {
  return [...links].sort((a, b) => {
    const rankDelta =
      KIND_RANK[classifyPlayback(a.fileName).kind] -
      KIND_RANK[classifyPlayback(b.fileName).kind];
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

const KIND_BADGE_LABEL: Record<PlaybackKind, string> = {
  video: "Video",
  audio: "Audio",
  subtitle: "Subs",
  other: "File",
};

function FileKindBadge({ fileName }: { fileName: string }) {
  const { kind, browserPlayable } = classifyPlayback(fileName);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 border-2 border-foreground px-1.5 py-0.5 text-[10px] font-black uppercase",
        kind === "video" && "bg-accent text-accent-foreground",
        kind === "audio" && "bg-secondary text-secondary-foreground",
        kind === "subtitle" && "bg-muted text-muted-foreground",
        kind === "other" && "bg-background text-muted-foreground",
      )}
      title={
        kind === "video" || kind === "audio"
          ? browserPlayable
            ? "Plays in browser"
            : "Needs external player (VLC)"
          : undefined
      }
    >
      {KIND_BADGE_LABEL[kind]}
      {(kind === "video" || kind === "audio") && !browserPlayable ? " · VLC" : ""}
    </span>
  );
}

function PackFileRow({ link }: { link: AddedItemLinkDto }) {
  return (
    <div className="min-w-0 max-w-full">
      <div className="flex w-full min-w-0 items-stretch gap-2">
        <Button
          asChild
          className="h-auto min-h-10 min-w-0 flex-1 justify-start whitespace-normal px-3 py-2"
          variant="outline"
        >
          <a
            href={`/api/debrid/links/${link.id}/download`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <FileKindBadge fileName={link.fileName} />
              <span className="min-w-0 break-all text-left leading-tight sm:truncate">
                {link.fileName}
              </span>
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatBytes(link.fileSizeBytes ?? undefined)}
            </span>
          </a>
        </Button>
        {link.streamable ? (
          <Button
            asChild
            aria-label={`Play ${link.fileName}`}
            size="icon"
            variant="outline"
          >
            <Link href={`/player/${link.id}`}>
              <Play className="size-4" />
            </Link>
          </Button>
        ) : null}
        {isReadableMangaFile(link.fileName) ? (
          <Button
            asChild
            aria-label={`Read ${link.fileName}`}
            size="icon"
            variant="outline"
          >
            <Link href={`/reader/${link.id}`}>
              <BookOpen className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
      {link.hostDownload ? (
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          Host download: {hostDownloadLabel(link)}
        </p>
      ) : null}
    </div>
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

/**
 * A square status indicator sized to match the actions (3-dots) button:
 * a check when ready, the live progress % while Real-Debrid pulls the asset,
 * an alert on error, and a spinner for other in-flight states.
 */
function StatusBadge({
  item,
  size = "default",
}: {
  item: AddedItemDto;
  size?: "sm" | "default";
}) {
  const isActive = isActiveDebridStatus(item.status);
  const isSm = size === "sm";
  const square = cn(
    "inline-flex shrink-0 items-center justify-center border-2 border-foreground font-black tabular-nums shadow-line",
    isSm ? "size-8 text-[10px]" : "size-10 text-xs",
  );
  const iconSize = isSm ? "size-4" : "size-5";

  if (item.status === "ready") {
    return (
      <span
        className={cn(square, "bg-secondary text-secondary-foreground")}
        title={debridStatusLabel(item.status)}
      >
        <CheckCircle2 className={iconSize} />
      </span>
    );
  }

  if (item.status === "error") {
    return (
      <span
        className={cn(square, "bg-destructive text-destructive-foreground")}
        title={item.errorMessage ?? debridStatusLabel(item.status)}
      >
        <AlertTriangle className={iconSize} />
      </span>
    );
  }

  if (isActive) {
    return (
      <span
        className={cn(square, "bg-accent text-accent-foreground")}
        title={`${debridStatusLabel(item.status)} — ${item.progress}%`}
      >
        {item.progress > 0 ? (
          `${item.progress}%`
        ) : (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(square, "bg-background text-foreground")}
      title={debridStatusLabel(item.status)}
    >
      <ArrowDownToLine className={iconSize} />
    </span>
  );
}

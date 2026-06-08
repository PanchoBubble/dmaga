"use client";

/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MangaFileKind } from "@/lib/manga";
import { formatBytes } from "@/lib/search";

type MangaReaderProps = {
  linkId: string;
  fileName: string;
  fileSizeBytes?: number | null;
  kind: MangaFileKind;
};

type ArchivePage = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

type ArchiveLoadProgress = {
  receivedBytes: number;
  totalBytes?: number;
};

type ArchiveLoadEvent =
  | { type: "status"; message: string }
  | ({ type: "download" } & ArchiveLoadProgress)
  | { type: "done"; pages: ArchivePage[] }
  | { type: "error"; message: string; status: number };

export function MangaReader({
  linkId,
  fileName,
  fileSizeBytes,
  kind,
}: MangaReaderProps) {
  const [pages, setPages] = useState<ArchivePage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    kind === "archive" ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [loadMessage, setLoadMessage] = useState("Preparing archive");
  const [loadProgress, setLoadProgress] = useState<ArchiveLoadProgress | null>(null);
  const [loadLogs, setLoadLogs] = useState<string[]>([]);

  useEffect(() => {
    if (kind !== "archive") {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const pushLog = (message: string) => {
      setLoadLogs((current) => [...current.slice(-3), message]);
    };

    void (async () => {
      try {
        setStatus("loading");
        setError(null);
        setLoadMessage("Preparing archive");
        setLoadProgress(null);
        setLoadLogs(["Preparing archive"]);

        const response = await fetch(`/api/reader/${linkId}/pages?stream=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Unable to load pages.");
        }
        await readArchiveLoadEvents(response, (event) => {
          if (cancelled) {
            return;
          }
          if (event.type === "status") {
            setLoadMessage(event.message);
            pushLog(event.message);
          } else if (event.type === "download") {
            setLoadProgress({
              receivedBytes: event.receivedBytes,
              totalBytes: event.totalBytes,
            });
            setLoadMessage("Downloading archive");
          } else if (event.type === "done") {
            setPages(event.pages ?? []);
            setPageIndex(0);
            setFolder(defaultFolder(event.pages ?? []));
            setLoadMessage(`Found ${(event.pages ?? []).length} image pages`);
            pushLog(`Found ${(event.pages ?? []).length} image pages`);
            setStatus("success");
          } else {
            throw new Error(event.message);
          }
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load pages.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [kind, linkId]);

  const folders = useMemo(() => archiveFolders(pages), [pages]);
  const visiblePages = useMemo(
    () => pages.filter((page) => folderForPage(page.name) === folder),
    [folder, pages],
  );
  const currentPage = visiblePages[pageIndex];
  const currentPageUrl = useMemo(() => {
    if (!currentPage) {
      return null;
    }
    const params = new URLSearchParams({ name: currentPage.name });
    return `/api/reader/${linkId}/page?${params}`;
  }, [currentPage, linkId]);

  return (
    <div className="space-y-4">
      <section className="border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-black leading-tight sm:text-2xl">
              {fileName}
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {[kind.toUpperCase(), formatBytes(fileSizeBytes ?? undefined)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`/api/debrid/links/${linkId}/download`}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        </div>
      </section>

      {kind === "archive" ? (
        <ArchiveReader
          currentPage={currentPage}
          currentPageUrl={currentPageUrl}
          error={error}
          pageIndex={pageIndex}
          pages={visiblePages}
          folders={folders}
          folder={folder}
          setFolder={(nextFolder) => {
            setFolder(nextFolder);
            setPageIndex(0);
          }}
          setPageIndex={setPageIndex}
          status={status}
          loadLogs={loadLogs}
          loadMessage={loadMessage}
          loadProgress={loadProgress}
        />
      ) : kind === "pdf" ? (
        <iframe
          className="h-[calc(100vh-14rem)] min-h-[32rem] w-full border-2 border-foreground bg-card shadow-line"
          src={`/api/debrid/links/${linkId}/download`}
          title={fileName}
        />
      ) : kind === "image" ? (
        <div className="border-2 border-foreground bg-card p-2 shadow-line">
          <img
            alt={fileName}
            className="mx-auto max-h-none w-full max-w-5xl object-contain"
            src={`/api/debrid/links/${linkId}/download`}
          />
        </div>
      ) : (
        <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
          <p className="text-lg font-black">This file is not readable inline yet.</p>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            The MVP supports CBZ/ZIP archives, PDFs, and image files.
          </p>
        </div>
      )}
    </div>
  );
}

function ArchiveReader({
  currentPage,
  currentPageUrl,
  error,
  pageIndex,
  pages,
  folders,
  folder,
  setFolder,
  setPageIndex,
  status,
  loadLogs,
  loadMessage,
  loadProgress,
}: {
  currentPage?: ArchivePage;
  currentPageUrl: string | null;
  error: string | null;
  pageIndex: number;
  pages: ArchivePage[];
  folders: string[];
  folder: string;
  setFolder: (folder: string) => void;
  setPageIndex: (index: number) => void;
  status: "idle" | "loading" | "success" | "error";
  loadLogs: string[];
  loadMessage: string;
  loadProgress: ArchiveLoadProgress | null;
}) {
  if (status === "loading") {
    const percent =
      loadProgress?.totalBytes && loadProgress.totalBytes > 0
        ? Math.min(
            100,
            Math.round((loadProgress.receivedBytes / loadProgress.totalBytes) * 100),
          )
        : null;

    return (
      <div className="space-y-3 border-2 border-foreground bg-card p-4 shadow-line">
        <div className="flex items-center gap-2 text-sm font-black">
          <Loader2 className="size-4 animate-spin" />
          {loadMessage}
        </div>
        {loadProgress ? (
          <div className="space-y-1">
            <div className="h-3 overflow-hidden border-2 border-foreground bg-background">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: percent === null ? "35%" : `${percent}%` }}
              />
            </div>
            <p className="text-xs font-bold text-muted-foreground">
              {formatBytes(loadProgress.receivedBytes)}
              {loadProgress.totalBytes
                ? ` / ${formatBytes(loadProgress.totalBytes)}`
                : " downloaded"}
            </p>
          </div>
        ) : null}
        {loadLogs.length ? (
          <ol className="space-y-1 text-xs font-bold text-muted-foreground">
            {loadLogs.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
        <p className="text-lg font-black">Couldn&apos;t open this archive.</p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!currentPage || !currentPageUrl) {
    return (
      <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
        <p className="text-lg font-black">No image pages found.</p>
      </div>
    );
  }

  const canGoBack = pageIndex > 0;
  const canGoForward = pageIndex < pages.length - 1;

  return (
    <div className="space-y-3">
      <div className="sticky top-3 z-20 flex items-center justify-between gap-3 border-2 border-foreground bg-card p-2 shadow-line">
        <Button
          className="size-9"
          disabled={!canGoBack}
          onClick={() => setPageIndex(pageIndex - 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 text-center text-sm font-black">
          {pageIndex + 1} / {pages.length}
        </p>
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex">
          {folders.length > 1 ? (
            <select
              aria-label="Folder"
              className="h-9 max-w-60 min-w-0 border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setFolder(event.target.value)}
              value={folder}
            >
              {folders.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate || "Archive root"}
                </option>
              ))}
            </select>
          ) : null}
          <select
            aria-label="Page"
            className="h-9 max-w-72 min-w-0 border-2 border-foreground bg-background px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setPageIndex(Number(event.target.value))}
            value={pageIndex}
          >
            {pages.map((page, index) => (
              <option key={page.name} value={index}>
                {fileNameForPage(page.name)}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="size-9"
          disabled={!canGoForward}
          onClick={() => setPageIndex(pageIndex + 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-2 border-2 border-foreground bg-card p-2 shadow-line md:hidden">
        {folders.length > 1 ? (
          <select
            aria-label="Folder"
            className="h-10 w-full border-2 border-foreground bg-background px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setFolder(event.target.value)}
            value={folder}
          >
            {folders.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate || "Archive root"}
              </option>
            ))}
          </select>
        ) : null}
        <select
          aria-label="Page"
          className="h-10 w-full border-2 border-foreground bg-background px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setPageIndex(Number(event.target.value))}
          value={pageIndex}
        >
          {pages.map((page, index) => (
            <option key={page.name} value={index}>
              {fileNameForPage(page.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="border-2 border-foreground bg-card p-2 shadow-line">
        <img
          alt={currentPage.name}
          className="mx-auto w-full max-w-5xl object-contain"
          src={currentPageUrl}
        />
      </div>
    </div>
  );
}

function archiveFolders(pages: ArchivePage[]): string[] {
  return [...new Set(pages.map((page) => folderForPage(page.name)))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function defaultFolder(pages: ArchivePage[]): string {
  return archiveFolders(pages)[0] ?? "";
}

function folderForPage(name: string): string {
  const index = name.lastIndexOf("/");
  return index === -1 ? "" : name.slice(0, index);
}

function fileNameForPage(name: string): string {
  const index = name.lastIndexOf("/");
  return index === -1 ? name : name.slice(index + 1);
}

async function readArchiveLoadEvents(
  response: Response,
  onEvent: (event: ArchiveLoadEvent) => void,
) {
  if (!response.body) {
    const payload = (await response.json()) as {
      pages?: ArchivePage[];
      error?: string;
    };
    if (payload.error) {
      onEvent({ type: "error", message: payload.error, status: response.status });
    } else {
      onEvent({ type: "done", pages: payload.pages ?? [] });
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      onEvent(JSON.parse(line) as ArchiveLoadEvent);
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as ArchiveLoadEvent);
  }
}

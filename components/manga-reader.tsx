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

  useEffect(() => {
    if (kind !== "archive") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/reader/${linkId}/pages`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          pages?: ArchivePage[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load pages.");
        }
        if (!cancelled) {
          setPages(payload.pages ?? []);
          setPageIndex(0);
          setFolder(defaultFolder(payload.pages ?? []));
          setStatus("success");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load pages.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
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
}) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 border-2 border-foreground bg-card px-3 py-2 text-sm font-black shadow-line">
        <Loader2 className="size-4 animate-spin" />
        Loading pages
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

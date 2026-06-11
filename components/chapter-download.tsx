"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Client-side chapter exporter. The page images are already same-origin (served
 * through /api/manga/proxy), so we can decode them in a canvas — the browser
 * handles webp/avif/jpg/png natively — and assemble a PDF (read anywhere) or a
 * CBZ (raw images, manga-reader native) without any server-side transcoding.
 *
 * Both libraries are dynamically imported inside the handlers so they stay out
 * of the reader's initial bundle until someone actually downloads.
 */
type Job = { format: "PDF" | "CBZ"; done: number; total: number };

export function ChapterDownload({ pages, title }: { pages: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = job !== null;
  const filename = slugify(title);

  async function downloadPdf() {
    setError(null);
    setOpen(false);
    setJob({ format: "PDF", done: 0, total: pages.length });
    try {
      const { jsPDF } = await import("jspdf");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas not supported in this browser.");
      }

      let doc: InstanceType<typeof jsPDF> | null = null;
      for (let i = 0; i < pages.length; i += 1) {
        const img = await loadImage(pages[i]);
        const w = img.naturalWidth || 800;
        const h = img.naturalHeight || 1200;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.85);
        const orientation = w >= h ? "landscape" : "portrait";
        if (doc) {
          doc.addPage([w, h], orientation);
        } else {
          doc = new jsPDF({ unit: "px", format: [w, h], orientation });
        }
        doc.addImage(data, "JPEG", 0, 0, w, h);
        setJob({ format: "PDF", done: i + 1, total: pages.length });
      }
      if (!doc) {
        throw new Error("This chapter has no pages to export.");
      }
      triggerDownload(doc.output("blob"), `${filename}.pdf`);
    } catch (caught) {
      setError(messageOf(caught, "PDF export failed."));
    } finally {
      setJob(null);
    }
  }

  async function downloadCbz() {
    setError(null);
    setOpen(false);
    setJob({ format: "CBZ", done: 0, total: pages.length });
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const pad = Math.max(2, String(pages.length).length);
      for (let i = 0; i < pages.length; i += 1) {
        const res = await fetch(pages[i]);
        if (!res.ok) {
          throw new Error(`Page ${i + 1} failed to download (${res.status}).`);
        }
        const blob = await res.blob();
        const name = `${String(i + 1).padStart(pad, "0")}.${extFromType(blob.type)}`;
        zip.file(name, blob);
        setJob({ format: "CBZ", done: i + 1, total: pages.length });
      }
      const out = await zip.generateAsync({ type: "blob" });
      triggerDownload(out, `${filename}.cbz`);
    } catch (caught) {
      setError(messageOf(caught, "CBZ export failed."));
    } finally {
      setJob(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <Button
        aria-expanded={open}
        className="gap-1.5"
        disabled={busy || pages.length === 0}
        onClick={() => setOpen((value) => !value)}
        size="sm"
        type="button"
        variant="outline"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        <span className="tabular-nums">
          {busy ? `${job.format} ${job.done}/${job.total}` : "Download"}
        </span>
      </Button>

      {open && !busy ? (
        <>
          {/* Click-away backdrop. */}
          <button
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="absolute right-0 z-20 mt-2 w-44 border-2 border-foreground bg-background shadow-line">
            <button
              className="block w-full px-3 py-2 text-left text-sm font-bold hover:bg-secondary"
              onClick={downloadPdf}
              type="button"
            >
              PDF
              <span className="block text-xs font-semibold text-muted-foreground">
                Read anywhere
              </span>
            </button>
            <button
              className="block w-full border-t-2 border-foreground px-3 py-2 text-left text-sm font-bold hover:bg-secondary"
              onClick={downloadCbz}
              type="button"
            >
              CBZ
              <span className="block text-xs font-semibold text-muted-foreground">
                Original quality · manga apps
              </span>
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="absolute right-0 z-20 mt-2 w-52 border-2 border-destructive bg-background p-2 text-xs font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "chapter"
  );
}

function extFromType(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

function messageOf(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load page image.`));
    img.src = src;
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after the browser has had a moment to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

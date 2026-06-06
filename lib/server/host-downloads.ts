import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { debridLinks, hostDownloads } from "@/lib/db/schema";
import { env } from "@/lib/server/env";

export class HostDownloadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "HostDownloadError";
  }
}

export async function queueHostDownload(debridLinkId: string) {
  const [link] = await db
    .select()
    .from(debridLinks)
    .where(eq(debridLinks.id, debridLinkId))
    .limit(1);

  if (!link) {
    throw new HostDownloadError("Debrid link not found.", 404);
  }

  const sourceUrl = link.unrestrictedLink ?? link.originalLink;
  if (!sourceUrl) {
    throw new HostDownloadError("No downloadable URL is available for this link.");
  }

  const targetPath = await nextAvailablePath(link.fileName);
  const [download] = await db
    .insert(hostDownloads)
    .values({
      debridLinkId,
      status: "queued",
      targetPath,
    })
    .returning();

  void runHostDownload(download.id);

  return download;
}

async function runHostDownload(downloadId: string) {
  const now = new Date();
  const [download] = await db
    .select()
    .from(hostDownloads)
    .where(eq(hostDownloads.id, downloadId))
    .limit(1);

  if (!download) {
    return;
  }

  const [link] = await db
    .select()
    .from(debridLinks)
    .where(eq(debridLinks.id, download.debridLinkId))
    .limit(1);

  if (!link) {
    await markDownloadError(downloadId, "Debrid link not found.");
    return;
  }

  try {
    await db
      .update(hostDownloads)
      .set({ status: "running", startedAt: now, updatedAt: now })
      .where(eq(hostDownloads.id, downloadId));

    const response = await fetch(link.unrestrictedLink ?? link.originalLink);
    if (!response.ok || !response.body) {
      throw new HostDownloadError(
        `Download request failed: ${response.status} ${response.statusText}`,
        502,
      );
    }

    await mkdir(path.dirname(download.targetPath), { recursive: true });
    const writer = createWriteStream(download.targetPath, { flags: "wx" });
    const reader = response.body.getReader();
    let bytesDownloaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytesDownloaded += value.byteLength;
      if (!writer.write(value)) {
        await onceDrain(writer);
      }
    }

    writer.end();
    await finished(writer);

    await db
      .update(hostDownloads)
      .set({
        status: "complete",
        bytesDownloaded,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hostDownloads.id, downloadId));
  } catch (error) {
    await markDownloadError(
      downloadId,
      error instanceof Error ? error.message : "Host download failed.",
    );
  }
}

async function markDownloadError(downloadId: string, message: string) {
  await db
    .update(hostDownloads)
    .set({
      status: "error",
      errorMessage: message,
      updatedAt: new Date(),
    })
    .where(eq(hostDownloads.id, downloadId));
}

async function nextAvailablePath(fileName: string) {
  const downloadDir = path.resolve(env.HOST_DOWNLOAD_DIR);
  const safeName = sanitizeFileName(fileName);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidateName =
      attempt === 0 ? safeName : withSuffix(safeName, `-${attempt + 1}`);
    const candidatePath = path.resolve(downloadDir, candidateName);
    ensureInside(downloadDir, candidatePath);

    if (!(await exists(candidatePath))) {
      return candidatePath;
    }
  }

  throw new HostDownloadError("Unable to find an available download filename.");
}

function sanitizeFileName(fileName: string) {
  const baseName = path
    .basename(fileName)
    .replace(/[^\w .()[\]-]+/g, "_")
    .trim();
  return baseName || `download-${Date.now()}`;
}

function withSuffix(fileName: string, suffix: string) {
  const extension = path.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  return `${stem}${suffix}${extension}`;
}

function ensureInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HostDownloadError("Download path must stay inside HOST_DOWNLOAD_DIR.");
  }
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function onceDrain(writer: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve) => {
    writer.once("drain", resolve);
  });
}

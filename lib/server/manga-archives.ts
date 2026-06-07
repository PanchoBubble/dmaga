import "server-only";

import { inflateRawSync } from "node:zlib";

import { isMangaImageFile, MANGA_IMAGE_MIME_TYPES } from "@/lib/manga";

export type MangaArchiveEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

type ZipEntry = MangaArchiveEntry & {
  compressionMethod: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export function listMangaArchivePages(buffer: Buffer): MangaArchiveEntry[] {
  return readZipEntries(buffer)
    .filter((entry) => isMangaArchivePage(entry.name))
    .map(({ name, compressedSize, uncompressedSize }) => ({
      name,
      compressedSize,
      uncompressedSize,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

export function readMangaArchivePage(
  buffer: Buffer,
  name: string,
): { bytes: Buffer; mimeType: string } | null {
  const entry = readZipEntries(buffer).find((candidate) => candidate.name === name);
  if (!entry || !isMangaArchivePage(entry.name)) {
    return null;
  }

  const localHeaderOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);
  const bytes =
    entry.compressionMethod === 0
      ? compressed
      : entry.compressionMethod === 8
        ? inflateRawSync(compressed)
        : null;

  if (!bytes) {
    return null;
  }

  return {
    bytes,
    mimeType: mimeTypeForImageName(entry.name),
  };
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    return [];
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const maxCommentLength = 0xffff;
  const minOffset = Math.max(0, buffer.length - maxCommentLength - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

function isMangaArchivePage(name: string): boolean {
  return !name.startsWith("__MACOSX/") && isMangaImageFile(name);
}

function mimeTypeForImageName(name: string): string {
  const extension = name.match(/\.([a-z0-9]+)\s*$/i)?.[1]?.toLowerCase() ?? "";
  return MANGA_IMAGE_MIME_TYPES[extension] ?? "application/octet-stream";
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
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

const runtimeRequire = createRequire(import.meta.url);
const unrarPackageName = "node-unrar-js";

type UnrarModule = {
  createExtractorFromData(options: {
    data: ArrayBuffer;
    wasmBinary: ArrayBuffer;
  }): Promise<{
    getFileList(): {
      fileHeaders: Generator<{
        name: string;
        flags: { directory: boolean };
        packSize: number;
        unpSize: number;
      }>;
    };
    extract(options: { files: string[] }): {
      files: Generator<{
        fileHeader: { name: string };
        extraction?: Uint8Array;
      }>;
    };
  }>;
};

export async function listMangaArchivePages(
  buffer: Buffer,
  fileName: string,
): Promise<MangaArchiveEntry[]> {
  if (isRarArchive(fileName)) {
    return listRarPages(buffer);
  }

  return readZipEntries(buffer)
    .filter((entry) => isMangaArchivePage(entry.name))
    .map(({ name, compressedSize, uncompressedSize }) => ({
      name,
      compressedSize,
      uncompressedSize,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

export async function readMangaArchivePage(
  buffer: Buffer,
  fileName: string,
  name: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (isRarArchive(fileName)) {
    return readRarPage(buffer, name);
  }

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

async function listRarPages(buffer: Buffer): Promise<MangaArchiveEntry[]> {
  const extractor = await createRarExtractor(buffer);
  const list = extractor.getFileList();

  return [...list.fileHeaders]
    .filter((entry) => !entry.flags.directory && isMangaArchivePage(entry.name))
    .map((entry) => ({
      name: entry.name,
      compressedSize: entry.packSize,
      uncompressedSize: entry.unpSize,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));
}

async function readRarPage(
  buffer: Buffer,
  name: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const extractor = await createRarExtractor(buffer);
  const extracted = extractor.extract({ files: [name] });
  const files = [...extracted.files];
  const file = files.find((candidate) => candidate.fileHeader.name === name);

  if (!file?.extraction || !isMangaArchivePage(file.fileHeader.name)) {
    return null;
  }

  return {
    bytes: Buffer.from(file.extraction),
    mimeType: mimeTypeForImageName(file.fileHeader.name),
  };
}

async function createRarExtractor(buffer: Buffer) {
  const unrar = runtimeRequire(`${unrarPackageName}/dist`) as UnrarModule;

  return unrar.createExtractorFromData({
    data: bufferToArrayBuffer(buffer),
    wasmBinary: bufferToArrayBuffer(readUnrarWasmBinary()),
  });
}

function readUnrarWasmBinary(): Buffer {
  return readFileSync(
    join(process.cwd(), "node_modules", unrarPackageName, "esm", "js", "unrar.wasm"),
  );
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
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

function isRarArchive(name: string): boolean {
  return /\.(cbr|rar)$/i.test(name);
}

function mimeTypeForImageName(name: string): string {
  const extension = name.match(/\.([a-z0-9]+)\s*$/i)?.[1]?.toLowerCase() ?? "";
  return MANGA_IMAGE_MIME_TYPES[extension] ?? "application/octet-stream";
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

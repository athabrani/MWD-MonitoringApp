export type ImportSourceKind = "csv-file" | "zip-entry" | "folder-file";

export interface NormalizedImportSource {
  id: string;
  fileName: string;
  sourcePath: string;
  sourceKind: ImportSourceKind;
  size: number;
  content: string;
}

export interface SkippedImportSource {
  fileName: string;
  sourcePath: string;
  reason: string;
  sourceKind: "selected-file" | "zip-entry";
}

export interface ImportSourceBatch {
  inputFileCount: number;
  zipFileCount: number;
  discoveredFileCount: number;
  validCsvCount: number;
  validSources: NormalizedImportSource[];
  skippedSources: SkippedImportSource[];
  duplicateFileNames: string[];
}

interface ZipEntry {
  fileName: string;
  sourcePath: string;
  data: Uint8Array;
}

let batchIdCounter = 0;

function makeSourceId(prefix: string): string {
  batchIdCounter += 1;
  return `${prefix}-${Date.now()}-${batchIdCounter}`;
}

function getRelativeFilePath(file: File): string {
  const withDirectory = file as File & { webkitRelativePath?: string };
  return withDirectory.webkitRelativePath || file.name;
}

function isCsvPath(path: string): boolean {
  return path.toLowerCase().endsWith(".csv");
}

function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

function decodeZipFileName(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes).replace(/\\/g, "/");
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateZipEntry(data: Uint8Array): Promise<Uint8Array> {
  const decompressor = globalThis.DecompressionStream;
  if (!decompressor) {
    throw new Error("Browser ini belum mendukung ekstraksi ZIP deflate. Gunakan CSV langsung atau browser modern.");
  }

  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const inflate = async (format: CompressionFormat) => {
    const stream = new Blob([buffer]).stream().pipeThrough(new decompressor(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  try {
    return await inflate("deflate-raw" as CompressionFormat);
  } catch {
    return inflate("deflate");
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (readUint32(view, offset) === 0x06054b50) return offset;
  }
  return -1;
}

async function extractZipCsvEntries(zipFile: File): Promise<{ entries: ZipEntry[]; skipped: SkippedImportSource[] }> {
  const bytes = new Uint8Array(await zipFile.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    return {
      entries: [],
      skipped: [{
        fileName: zipFile.name,
        sourcePath: zipFile.name,
        sourceKind: "selected-file",
        reason: "ZIP structure tidak valid.",
      }],
    };
  }

  const centralDirectorySize = readUint32(view, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(view, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  const entries: ZipEntry[] = [];
  const skipped: SkippedImportSource[] = [];

  let offset = centralDirectoryOffset;
  while (offset < centralDirectoryEnd) {
    if (readUint32(view, offset) !== 0x02014b50) break;

    const flags = readUint16(view, offset + 8);
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localHeaderOffset = readUint32(view, offset + 42);
    const fileName = decodeZipFileName(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    const isDirectory = fileName.endsWith("/");
    const sourcePath = `${zipFile.name}/${fileName}`;

    if (!isDirectory && !isCsvPath(fileName)) {
      skipped.push({
        fileName,
        sourcePath,
        sourceKind: "zip-entry",
        reason: "Bukan file CSV.",
      });
    } else if (!isDirectory && (flags & 0x1) === 0x1) {
      skipped.push({
        fileName,
        sourcePath,
        sourceKind: "zip-entry",
        reason: "ZIP entry terenkripsi tidak didukung.",
      });
    } else if (!isDirectory && readUint32(view, localHeaderOffset) === 0x04034b50) {
      const localFileNameLength = readUint16(view, localHeaderOffset + 26);
      const localExtraLength = readUint16(view, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

      try {
        const data = method === 0 ? compressedData : method === 8 ? await inflateZipEntry(compressedData) : null;
        if (data) {
          entries.push({ fileName: fileName.split("/").pop() || fileName, sourcePath, data });
        } else {
          skipped.push({
            fileName,
            sourcePath,
            sourceKind: "zip-entry",
            reason: `ZIP compression method ${method} tidak didukung.`,
          });
        }
      } catch (error) {
        skipped.push({
          fileName,
          sourcePath,
          sourceKind: "zip-entry",
          reason: error instanceof Error ? error.message : "Gagal mengekstrak CSV dari ZIP.",
        });
      }
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return { entries, skipped };
}

function summarizeDuplicateNames(sources: NormalizedImportSource[]): string[] {
  const counts = sources.reduce<Record<string, number>>((accumulator, source) => {
    const key = source.fileName.toLowerCase();
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
}

export function countCsvRecords(content: string): number {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

export async function collectImportSources(input: FileList | File[] | null | undefined): Promise<ImportSourceBatch> {
  const files = Array.from(input ?? []);
  const validSources: NormalizedImportSource[] = [];
  const skippedSources: SkippedImportSource[] = [];
  let discoveredFileCount = 0;
  let zipFileCount = 0;

  for (const file of files) {
    const sourcePath = getRelativeFilePath(file);
    if (isZipFile(file)) {
      zipFileCount += 1;
      const { entries, skipped } = await extractZipCsvEntries(file);
      discoveredFileCount += entries.length + skipped.length;
      skippedSources.push(...skipped);

      for (const entry of entries) {
        const content = new TextDecoder("utf-8").decode(entry.data);
        if (!content.trim()) {
          skippedSources.push({
            fileName: entry.fileName,
            sourcePath: entry.sourcePath,
            sourceKind: "zip-entry",
            reason: "CSV kosong.",
          });
          continue;
        }

        validSources.push({
          id: makeSourceId("zip-csv"),
          fileName: entry.fileName,
          sourcePath: entry.sourcePath,
          sourceKind: "zip-entry",
          size: entry.data.byteLength,
          content,
        });
      }
      continue;
    }

    discoveredFileCount += 1;
    if (!isCsvPath(file.name)) {
      skippedSources.push({
        fileName: file.name,
        sourcePath,
        sourceKind: "selected-file",
        reason: "Bukan file CSV atau ZIP.",
      });
      continue;
    }

    const content = await file.text();
    if (!content.trim()) {
      skippedSources.push({
        fileName: file.name,
        sourcePath,
        sourceKind: "selected-file",
        reason: "CSV kosong.",
      });
      continue;
    }

    validSources.push({
      id: makeSourceId(sourcePath.includes("/") ? "folder-csv" : "csv"),
      fileName: file.name,
      sourcePath,
      sourceKind: sourcePath.includes("/") ? "folder-file" : "csv-file",
      size: file.size,
      content,
    });
  }

  return {
    inputFileCount: files.length,
    zipFileCount,
    discoveredFileCount,
    validCsvCount: validSources.length,
    validSources,
    skippedSources,
    duplicateFileNames: summarizeDuplicateNames(validSources),
  };
}

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const VIDEO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE_EXTENSION = ".mp4";

export class InvalidVideoIdError extends Error {
  constructor(videoId: string) {
    super(`video id is not a UUID: "${videoId.slice(0, 64)}"`);
    this.name = "InvalidVideoIdError";
  }
}

/** Whether a value has the shape of a Studio video id, so it is safe inside a file path. */
export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

/**
 * Where a video's MP4 lives. Only UUIDs reach the file system, so no id can leave the folder.
 *
 * @throws {InvalidVideoIdError} When the id is not a lowercase UUID.
 */
export function videoFilePath(directory: string, videoId: string): string {
  if (isVideoId(videoId) === false) throw new InvalidVideoIdError(videoId);

  return path.join(path.resolve(directory), `${videoId}${FILE_EXTENSION}`);
}

/** The address the library links to; the route behind it checks who is asking. */
export function videoDownloadUrl(videoId: string): string {
  return `/api/studio/videos/${videoId}`;
}

/**
 * Writes a finished video to disk, creating the folder on first use.
 *
 * @throws {InvalidVideoIdError} When the id is not a lowercase UUID.
 */
export async function saveVideoFile(
  directory: string,
  videoId: string,
  bytes: Uint8Array,
): Promise<void> {
  const filePath = videoFilePath(directory, videoId);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

/** Deletes the files of expired videos; a file already gone is fine. */
export async function removeVideoFiles(
  directory: string,
  videoIds: readonly string[],
): Promise<void> {
  await Promise.all(
    videoIds.map((videoId) =>
      rm(videoFilePath(directory, videoId), { force: true }),
    ),
  );
}

/** The size of a stored video, or null when the file is not there. */
export async function readVideoFileSize(
  directory: string,
  videoId: string,
): Promise<number | null> {
  try {
    const info = await stat(videoFilePath(directory, videoId));

    return info.isFile() ? info.size : null;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;

    throw error;
  }
}

export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Reads a single-range "Range: bytes=…" header, which phone players (Safari above all) send
 * before playing a video.
 *
 * @param header - The Range header, or null when the request has none.
 * @param size - The file size in bytes.
 * @returns The inclusive range to send, "whole" for a normal request, or "unsatisfiable".
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "whole" | "unsatisfiable" {
  if (header == null) return "whole";

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());

  // Several ranges or another unit: answering with the whole file is allowed.
  if (match == null) return "whole";

  const [, startText = "", endText = ""] = match;

  if (startText === "" && endText === "") return "unsatisfiable";

  if (startText === "") {
    const suffix = Number(endText);

    if (suffix === 0 || size === 0) return "unsatisfiable";

    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }

  const start = Number(startText);
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);

  if (start >= size || start > end) return "unsatisfiable";

  return { start, end };
}

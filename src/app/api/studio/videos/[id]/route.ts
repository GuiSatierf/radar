import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getDatabase } from "@/db/client";
import { videoFileName } from "@/features/studio/domain/library";
import { findDownloadableVideo } from "@/features/studio/queries";
import {
  isVideoId,
  parseByteRange,
  readVideoFileSize,
  videoFilePath,
} from "@/features/studio/video-files";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkToolAccess } from "@/lib/session";

// The link works for a while in the same browser; the access check runs on every request anyway.
const CACHE_CONTROL = "private, max-age=3600";

function notFound(): Response {
  return new Response("Vídeo não encontrado.", { status: 404 });
}

function streamFile(filePath: string, start: number, end: number) {
  return Readable.toWeb(
    createReadStream(filePath, { start, end }),
  ) as ReadableStream<Uint8Array>;
}

/**
 * Sends a stored Studio video to its owner only. Supports Range requests, which phone players
 * need to play and seek.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/studio/videos/[id]">,
): Promise<Response> {
  const { user, isAllowed } = await checkToolAccess("studio");

  if (isAllowed === false) return notFound();

  const { id } = await context.params;

  if (isVideoId(id) === false) return notFound();

  const video = await findDownloadableVideo({
    db: getDatabase(),
    videoId: id,
    userId: user.id,
    now: new Date(),
  });

  if (video == null) return notFound();

  const directory = getServerEnv().VIDEO_FILES_DIR;
  const size = await readVideoFileSize(directory, id);

  if (size == null) {
    logger.warn({ videoId: id }, "ready video has no file");

    return notFound();
  }

  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": CACHE_CONTROL,
    "content-disposition": `inline; filename="${videoFileName(video.productName)}"`,
    "content-type": "video/mp4",
    "x-content-type-options": "nosniff",
  });
  const range = parseByteRange(request.headers.get("range"), size);

  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${size}`);

    return new Response(null, { status: 416, headers });
  }

  const filePath = videoFilePath(directory, id);

  if (range === "whole") {
    headers.set("content-length", String(size));

    return new Response(streamFile(filePath, 0, size - 1), { headers });
  }

  headers.set("content-length", String(range.end - range.start + 1));
  headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);

  return new Response(streamFile(filePath, range.start, range.end), {
    status: 206,
    headers,
  });
}

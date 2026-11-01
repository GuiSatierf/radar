import { randomUUID } from "node:crypto";
import { and, count, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { product, studioVideo } from "@/db/schema";
import type { VideoGenerator } from "@/sources/video/video-generator";
import { isVideoFormat, type VideoFormat } from "./domain/formats";
import { calculateVideoQuota, monthStartInBrazil } from "./domain/quota";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ready videos stay in the library this long; the screen tells the person. */
export const VIDEO_KEEP_DAYS = 15;
// A failed video stays a day, so the person sees it failed and that it cost nothing.
const FAILED_VIDEO_KEEP_IN_MS = MILLISECONDS_PER_DAY;
// Longer than any generation takes: past this, the worker that took it has died (a deploy, a crash).
const STUCK_AFTER_IN_MS = 15 * 60 * 1000;
const BATCH_SIZE = 5;
const MAX_ERROR_MESSAGE_LENGTH = 300;
const UNIQUE_VIOLATION = "23505";

const ACTIVE_STATUSES = ["queued", "generating"];

export type EnqueueRefusal = "product-not-found" | "no-videos-left" | "busy";

export type EnqueueResult =
  | { ok: true; videoId: string }
  | { ok: false; reason: EnqueueRefusal };

function readErrorCode(error: unknown): unknown {
  if (typeof error !== "object" || error == null) return undefined;

  if ("code" in error && error.code != null) return error.code;

  // Drizzle wraps the driver error in `cause`.
  if ("cause" in error) return readErrorCode(error.cause);

  return undefined;
}

/** Videos made in the current Brazil month that count toward the limit (failed ones do not). */
export async function countVideosThisMonth(
  db: Database,
  userId: string,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(studioVideo)
    .where(
      and(
        eq(studioVideo.userId, userId),
        gte(studioVideo.createdAt, monthStartInBrazil(now)),
        ne(studioVideo.status, "failed"),
      ),
    );

  return row?.total ?? 0;
}

async function hasActiveVideo(db: Database, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: studioVideo.id })
    .from(studioVideo)
    .where(
      and(
        eq(studioVideo.userId, userId),
        inArray(studioVideo.status, ACTIVE_STATUSES),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Puts a video in the queue after the server-side checks: the product exists, the month still
 * has videos left and the person has no other video being made.
 *
 * @param monthlyVideos - The plan's monthly limit (non-negative integer).
 * @returns The new video id, or why it was refused.
 */
export async function enqueueVideo(input: {
  db: Database;
  userId: string;
  productId: string;
  format: VideoFormat;
  monthlyVideos: number;
  now: Date;
}): Promise<EnqueueResult> {
  const { db, userId, now } = input;
  const [products, used, isBusy] = await Promise.all([
    db
      .select({ name: product.name, imageUrls: product.imageUrls })
      .from(product)
      .where(eq(product.id, input.productId))
      .limit(1),
    countVideosThisMonth(db, userId, now),
    hasActiveVideo(db, userId),
  ]);
  const picked = products[0];

  if (picked == null) return { ok: false, reason: "product-not-found" };

  if (calculateVideoQuota(input.monthlyVideos, used).remaining === 0) {
    return { ok: false, reason: "no-videos-left" };
  }

  if (isBusy) return { ok: false, reason: "busy" };

  const videoId = randomUUID();

  try {
    await db.insert(studioVideo).values({
      id: videoId,
      userId,
      productId: input.productId,
      productName: picked.name,
      productImageUrl: picked.imageUrls[0] ?? null,
      format: input.format,
      createdAt: now,
    });
  } catch (error) {
    // Two clicks at once: the one-active-video index lets only the first through.
    if (readErrorCode(error) === UNIQUE_VIOLATION) {
      return { ok: false, reason: "busy" };
    }

    throw error;
  }

  return { ok: true, videoId };
}

/** Marks as failed the videos whose worker died mid-generation, so the person can try again. */
async function failStuckVideos(db: Database, now: Date): Promise<number> {
  const stuck = await db
    .update(studioVideo)
    .set({
      status: "failed",
      errorMessage: "StuckGeneration: no result before the time limit",
      finishedAt: now,
      expiresAt: new Date(now.getTime() + FAILED_VIDEO_KEEP_IN_MS),
    })
    .where(
      and(
        eq(studioVideo.status, "generating"),
        lt(studioVideo.startedAt, new Date(now.getTime() - STUCK_AFTER_IN_MS)),
      ),
    )
    .returning({ id: studioVideo.id });

  return stuck.length;
}

/** Takes the oldest queued videos; SKIP LOCKED keeps two workers from taking the same one. */
async function claimQueuedVideos(db: Database, now: Date) {
  return db
    .update(studioVideo)
    .set({ status: "generating", startedAt: now })
    .where(
      sql`${studioVideo.id} in (
        select ${studioVideo.id} from ${studioVideo}
        where ${studioVideo.status} = 'queued'
        order by ${studioVideo.createdAt}
        limit ${BATCH_SIZE}
        for update skip locked
      )`,
    )
    .returning({
      id: studioVideo.id,
      productName: studioVideo.productName,
      productImageUrl: studioVideo.productImageUrl,
      format: studioVideo.format,
    });
}

function describeError(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return text.replace(/\s+/g, " ").slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

async function generateOne(input: {
  db: Database;
  generator: VideoGenerator;
  clock: () => Date;
  video: Awaited<ReturnType<typeof claimQueuedVideos>>[number];
}): Promise<"ready" | "failed"> {
  const { db, video } = input;
  // Only a video still "generating" is updated: the stuck check may have given up on it already.
  const stillGenerating = and(
    eq(studioVideo.id, video.id),
    eq(studioVideo.status, "generating"),
  );

  try {
    if (isVideoFormat(video.format) === false) {
      throw new Error(`unknown video format "${video.format}"`);
    }

    const result = await input.generator.generate({
      productName: video.productName,
      productImageUrl: video.productImageUrl,
      format: video.format,
    });
    const finishedAt = input.clock();

    await db
      .update(studioVideo)
      .set({
        status: "ready",
        videoUrl: result.videoUrl,
        finishedAt,
        expiresAt: new Date(
          finishedAt.getTime() + VIDEO_KEEP_DAYS * MILLISECONDS_PER_DAY,
        ),
      })
      .where(stillGenerating);

    return "ready";
  } catch (error) {
    const finishedAt = input.clock();

    await db
      .update(studioVideo)
      .set({
        status: "failed",
        errorMessage: describeError(error),
        finishedAt,
        expiresAt: new Date(finishedAt.getTime() + FAILED_VIDEO_KEEP_IN_MS),
      })
      .where(stillGenerating);

    return "failed";
  }
}

export interface QueueRunSummary {
  readonly ready: number;
  readonly failed: number;
  readonly stuck: number;
}

/**
 * One worker pass: gives up on stuck videos, then makes up to BATCH_SIZE queued videos.
 * Safe to run from several places at once (after a click and from the scheduled task).
 */
export async function processVideoQueue(input: {
  db: Database;
  generator: VideoGenerator;
  clock?: () => Date;
}): Promise<QueueRunSummary> {
  const clock = input.clock ?? (() => new Date());
  const stuck = await failStuckVideos(input.db, clock());
  const claimed = await claimQueuedVideos(input.db, clock());
  const outcomes = await Promise.all(
    claimed.map((video) =>
      generateOne({ db: input.db, generator: input.generator, clock, video }),
    ),
  );

  return {
    ready: outcomes.filter((outcome) => outcome === "ready").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
    stuck,
  };
}

/**
 * Takes expired videos out of the library. Ready videos keep their row, because they still count
 * toward the month's limit; only the link goes. Failed videos never counted, so their row goes too:
 * turning them into "expired" would start charging them.
 */
export async function expireOldVideos(
  db: Database,
  now: Date,
): Promise<number> {
  const [expired, removed] = await Promise.all([
    db
      .update(studioVideo)
      .set({ status: "expired", videoUrl: null })
      .where(
        and(eq(studioVideo.status, "ready"), lte(studioVideo.expiresAt, now)),
      )
      .returning({ id: studioVideo.id }),
    db
      .delete(studioVideo)
      .where(
        and(eq(studioVideo.status, "failed"), lte(studioVideo.expiresAt, now)),
      )
      .returning({ id: studioVideo.id }),
  ]);

  return expired.length + removed.length;
}

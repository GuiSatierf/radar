import { getDatabase } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFakeVideoGenerator } from "@/sources/video/fake-video-generator";
import { expireOldVideos, processVideoQueue } from "./queue";

/**
 * One full worker pass with the app's database: expired videos leave the library, then the queue
 * runs. Called right after a click and by the scheduled task;
 * never throws, it logs.
 *
 * @returns Whether the pass finished without an error.
 */
export async function runVideoQueue(): Promise<boolean> {
  try {
    const db = getDatabase();
    const env = getServerEnv();
    const expired = await expireOldVideos(db, new Date(), env.VIDEO_FILES_DIR);
    // The sample generator until the real video AI is wired in.
    const generator = createFakeVideoGenerator();
    const summary = await processVideoQueue({
      db,
      generator,
      videoFilesDir: env.VIDEO_FILES_DIR,
    });
    logger.info(
      { ...summary, expired, generator: generator.name },
      "video queue processed",
    );

    return true;
  } catch (error) {
    logger.error({ err: error }, "video queue failed");

    return false;
  }
}

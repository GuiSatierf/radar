import { getDatabase } from "@/db/client";
import { selectVideoGenerator } from "@/features/video-ai/select-video-generator";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { expireOldVideos, processVideoQueue } from "./queue";

/**
 * One full worker pass with the app's database: expired videos leave the library, then the queue
 * runs with the video AI the admin chose. Called right after a click and by the scheduled task;
 * never throws, it logs.
 *
 * @returns Whether the pass finished without an error.
 */
export async function runVideoQueue(): Promise<boolean> {
  try {
    const db = getDatabase();
    const env = getServerEnv();
    const expired = await expireOldVideos(db, new Date(), env.VIDEO_FILES_DIR);
    const generator = await selectVideoGenerator(db, env.VIDEO_KEYS_SECRET);
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

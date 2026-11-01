import { getDatabase } from "@/db/client";
import { logger } from "@/lib/logger";
import { createFakeVideoGenerator } from "@/sources/video/fake-video-generator";
import { expireOldVideos, processVideoQueue } from "./queue";

/**
 * One full worker pass with the app's database: expired videos leave the library, then the queue
 * runs. Called right after a click and by the scheduled task; never throws, it logs.
 *
 * @returns Whether the pass finished without an error.
 */
export async function runVideoQueue(): Promise<boolean> {
  try {
    const db = getDatabase();
    const expired = await expireOldVideos(db, new Date());
    // The sample generator until slice 2 brings a paid video API.
    const summary = await processVideoQueue({
      db,
      generator: createFakeVideoGenerator(),
    });
    logger.info({ ...summary, expired }, "video queue processed");

    return true;
  } catch (error) {
    logger.error({ err: error }, "video queue failed");

    return false;
  }
}

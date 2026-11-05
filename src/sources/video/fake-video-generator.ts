import { setTimeout as wait } from "node:timers/promises";
import type { GeneratedVideo, VideoGenerator } from "./video-generator";

/** A vertical, 8-second sample clip shipped in `public/`, the same for every product. */
export const SAMPLE_VIDEO_URL = "/studio/video-de-exemplo.mp4";

// Long enough for the screen to show "Gerando…", short enough not to slow anyone down.
const DEFAULT_GENERATION_TIME_IN_MS = 3_000;

/**
 * The sample generator: it costs nothing and always returns the sample clip. The Studio uses it
 * while the admin has not chosen a video AI, and the tests use it everywhere.
 */
export function createFakeVideoGenerator(
  options: { generationTimeInMs?: number } = {},
): VideoGenerator {
  const generationTimeInMs =
    options.generationTimeInMs ?? DEFAULT_GENERATION_TIME_IN_MS;

  return {
    name: "sample",
    async generate(): Promise<GeneratedVideo> {
      await wait(generationTimeInMs);

      return { kind: "link", videoUrl: SAMPLE_VIDEO_URL };
    },
  };
}

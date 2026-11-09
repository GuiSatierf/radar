import type { Database } from "@/db/client";
import { createFakeVideoGenerator } from "@/sources/video/fake-video-generator";
import { createGeminiOmniVideoGenerator } from "@/sources/video/gemini-omni-video-generator";
import type { VideoGenerator } from "@/sources/video/video-generator";
import { decryptVideoKey } from "./key-box";
import type { VideoProviderId } from "./providers";
import {
  type ChosenVideoModel,
  getVideoSettings,
  readVideoKeyCiphertext,
} from "./settings";

type GeneratorFactory = (options: {
  apiKey: string;
  model: string;
}) => VideoGenerator;

// One entry per service the app knows how to call; a new service adds its generator here.
const GENERATOR_BY_PROVIDER: Readonly<
  Record<VideoProviderId, GeneratorFactory>
> = {
  google: createGeminiOmniVideoGenerator,
};

export class VideoAiUnavailableError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(`chosen video AI cannot be used: ${reason}`, options);
    this.name = "VideoAiUnavailableError";
  }
}

/**
 * Fails every video with the reason, so the person sees "não deu certo" (which costs nothing)
 * instead of a sample clip passed off as their video.
 */
function unavailableGenerator(error: VideoAiUnavailableError): VideoGenerator {
  return {
    name: "unavailable",
    async generate() {
      throw error;
    },
  };
}

function generatorWithSavedKey(
  chosen: ChosenVideoModel,
  stored: string,
  keysSecret: string,
): VideoGenerator {
  try {
    const apiKey = decryptVideoKey(stored, keysSecret);

    return GENERATOR_BY_PROVIDER[chosen.provider]({
      apiKey,
      model: chosen.model,
    });
  } catch (error) {
    return unavailableGenerator(
      new VideoAiUnavailableError(
        `the ${chosen.provider} key cannot be read; the secret changed, paste the key again`,
        { cause: error },
      ),
    );
  }
}

/**
 * The generator the Studio uses right now: the admin's chosen video AI with its saved key, or the
 * sample generator when no AI is chosen.
 *
 * @param db - The app database.
 * @param keysSecret - VIDEO_KEYS_SECRET, or undefined when it is not set.
 */
export async function selectVideoGenerator(
  db: Database,
  keysSecret: string | undefined,
): Promise<VideoGenerator> {
  const { chosen } = await getVideoSettings(db);

  if (chosen == null) return createFakeVideoGenerator();

  const stored = await readVideoKeyCiphertext(db, chosen.provider);

  if (stored == null) {
    return unavailableGenerator(
      new VideoAiUnavailableError(`no key saved for ${chosen.provider}`),
    );
  }

  if (keysSecret == null) {
    return unavailableGenerator(
      new VideoAiUnavailableError("VIDEO_KEYS_SECRET is not set"),
    );
  }

  return generatorWithSavedKey(chosen, stored, keysSecret);
}

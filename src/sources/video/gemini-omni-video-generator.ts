import { setTimeout as wait } from "node:timers/promises";
import { z } from "zod";
import { downloadProductPhoto } from "./product-photo";
import type {
  GeneratedVideo,
  VideoGenerator,
  VideoRequest,
} from "./video-generator";
import { buildVideoPrompt } from "./video-prompt";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// The creation call may hold until the video is done, which takes minutes.
const CREATE_TIMEOUT_IN_MS = 10 * 60 * 1000;
const POLL_TIMEOUT_IN_MS = 60_000;
const POLL_INTERVAL_IN_MS = 10_000;
// Below the queue's 15 minutes, so the queue never gives up on a video that is still coming.
const TOTAL_DEADLINE_IN_MS = 13 * 60 * 1000;
const MAX_ERROR_BODY_LENGTH = 200;

/** Fixed for every Studio video: vertical, 8 seconds, 720p (the price shown to the admin). */
export const STUDIO_VIDEO_SHAPE = {
  type: "video",
  aspect_ratio: "9:16",
  duration: "8s",
  resolution: "720p",
  delivery: "inline",
} as const;

const TERMINAL_FAILURES = new Set([
  "failed",
  "cancelled",
  "incomplete",
  "requires_action",
  "requires_continuation",
]);

const interactionSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  steps: z
    .array(
      z.object({
        type: z.string(),
        content: z
          .array(
            z.object({
              type: z.string(),
              mime_type: z.string().optional(),
              data: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

type Interaction = z.infer<typeof interactionSchema>;

export class GeminiVideoError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(`Gemini video failed: ${reason}`, options);
    this.name = "GeminiVideoError";
  }
}

async function readInteraction(
  response: Response,
  step: string,
): Promise<Interaction> {
  if (response.ok === false) {
    const body = (await response.text()).replace(/\s+/g, " ");

    throw new GeminiVideoError(
      `${step} answered ${response.status}: ${body.slice(0, MAX_ERROR_BODY_LENGTH)}`,
    );
  }

  const parsed = interactionSchema.safeParse(await response.json());

  if (parsed.success === false) {
    throw new GeminiVideoError(`${step} answered an unknown shape`);
  }

  return parsed.data;
}

function describeFailure(interaction: Interaction): string {
  const messages = (interaction.errors ?? [])
    .map((error) => error.message)
    .filter((message) => message != null && message.trim() !== "");

  if (messages.length === 0) return `status ${interaction.status}`;

  return `status ${interaction.status}: ${messages.join("; ").slice(0, MAX_ERROR_BODY_LENGTH)}`;
}

/** The MP4 bytes from a finished interaction (REST puts them in the model_output step). */
function extractVideo(interaction: Interaction): Uint8Array {
  const video = (interaction.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .find((item) => item.type === "video" && item.data != null);

  // No video in a finished answer usually means the safety filter blocked it.
  if (video?.data == null || video.data.length === 0) {
    throw new GeminiVideoError("the answer has no video");
  }

  return new Uint8Array(Buffer.from(video.data, "base64"));
}

/**
 * Makes Studio videos with Google's Gemini Omni through the Interactions API: the product photo
 * and the prompt go in, an 8-second vertical MP4 comes back.
 *
 * @param options.apiKey - The Gemini API key the admin saved (already decrypted).
 * @param options.model - The model id, e.g. "gemini-omni-1.2-flash".
 * @param options.fetchImpl - The fetch to use; the tests pass a fake one and never call Google.
 * @param options.sleep - Waits between status checks; the tests make it instant.
 * @param options.now - The clock for the overall deadline.
 */
export function createGeminiOmniVideoGenerator(options: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}): VideoGenerator {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => wait(milliseconds));
  const now = options.now ?? Date.now;
  const headers = {
    "content-type": "application/json",
    "x-goog-api-key": options.apiKey,
  };

  async function create(request: VideoRequest): Promise<Interaction> {
    const photo =
      request.productImageUrl == null
        ? null
        : await downloadProductPhoto(request.productImageUrl, fetchImpl);
    const prompt = buildVideoPrompt({
      productName: request.productName,
      format: request.format,
      hasPhoto: photo != null,
    });
    const input = [
      ...(photo == null
        ? []
        : [{ type: "image", data: photo.base64, mime_type: photo.mimeType }]),
      { type: "text", text: prompt },
    ];
    const response = await fetchImpl(`${API_BASE_URL}/interactions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: options.model,
        input,
        generation_config: {
          video_config: {
            task: photo == null ? "text_to_video" : "image_to_video",
          },
        },
        response_format: STUDIO_VIDEO_SHAPE,
      }),
      signal: AbortSignal.timeout(CREATE_TIMEOUT_IN_MS),
    });

    return readInteraction(response, "create");
  }

  async function poll(id: string): Promise<Interaction> {
    const response = await fetchImpl(
      `${API_BASE_URL}/interactions/${encodeURIComponent(id)}`,
      { headers, signal: AbortSignal.timeout(POLL_TIMEOUT_IN_MS) },
    );

    return readInteraction(response, "status check");
  }

  return {
    name: `google:${options.model}`,
    async generate(request: VideoRequest): Promise<GeneratedVideo> {
      const deadline = now() + TOTAL_DEADLINE_IN_MS;
      let interaction = await create(request);

      while (interaction.status !== "completed") {
        if (TERMINAL_FAILURES.has(interaction.status)) {
          throw new GeminiVideoError(describeFailure(interaction));
        }

        if (now() >= deadline) {
          throw new GeminiVideoError("no video before the time limit");
        }

        await sleep(POLL_INTERVAL_IN_MS);
        interaction = await poll(interaction.id);
      }

      return { kind: "file", bytes: extractVideo(interaction) };
    },
  };
}

/**
 * The video AI services the Studio can use. Only services the app already knows how to call are
 * listed; each new one is added here with its generator.
 */
export const VIDEO_PROVIDER_IDS = ["google"] as const;
export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number];

export interface VideoModel {
  /** The id the service's API expects. */
  readonly id: string;
  readonly label: string;
  /** Rough cost for the admin, in plain words; prices change, so it says "cerca de". */
  readonly costHint: string;
}

export interface VideoProvider {
  readonly id: VideoProviderId;
  readonly name: string;
  /** Where the admin gets the key, in one sentence. */
  readonly keyHelp: string;
  readonly models: readonly VideoModel[];
}

export const VIDEO_PROVIDERS: Readonly<Record<VideoProviderId, VideoProvider>> =
  {
    google: {
      id: "google",
      name: "Google Gemini",
      keyHelp:
        "Crie em aistudio.google.com, em Get API key, numa conta com cobrança ligada.",
      models: [
        {
          id: "gemini-omni-1.2-flash",
          label: "Gemini Omni Flash",
          costHint: "cerca de R$ 3 por vídeo de 8 segundos",
        },
      ],
    },
  };

/** What the screen sends to go back to the sample video instead of a "provider:model" choice. */
export const SAMPLE_VIDEO_CHOICE = "sample";

export function isVideoProviderId(value: unknown): value is VideoProviderId {
  return VIDEO_PROVIDER_IDS.some((id) => id === value);
}

/** The model of that provider with this id, or null when the provider does not have it. */
export function findVideoModel(
  provider: VideoProviderId,
  modelId: string,
): VideoModel | null {
  return (
    VIDEO_PROVIDERS[provider].models.find((model) => model.id === modelId) ??
    null
  );
}

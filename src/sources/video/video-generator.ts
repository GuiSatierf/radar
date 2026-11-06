import type { VideoFormat } from "@/features/studio/domain/formats";

export interface VideoRequest {
  readonly productName: string;
  readonly productImageUrl: string | null;
  readonly format: VideoFormat;
}

/**
 * What a generator hands back: a link to a file that already exists (the sample clip), or the
 * bytes of a new MP4 that the Studio stores for the person.
 */
export type GeneratedVideo =
  | { readonly kind: "link"; readonly videoUrl: string }
  | { readonly kind: "file"; readonly bytes: Uint8Array };

/**
 * The single seam between the Studio and whatever makes the video (the sample generator or a
 * paid video API). The queue never knows which one it is talking to.
 */
export interface VideoGenerator {
  readonly name: string;
  generate(request: VideoRequest): Promise<GeneratedVideo>;
}

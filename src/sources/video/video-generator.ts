import type { VideoFormat } from "@/features/studio/domain/formats";

export interface VideoRequest {
  readonly productName: string;
  readonly productImageUrl: string | null;
  readonly format: VideoFormat;
}

export interface GeneratedVideo {
  /** Where the person downloads the video from. */
  readonly videoUrl: string;
}

/**
 * The single seam between the Studio and whatever makes the video (the sample generator today,
 * an official paid video API later). The queue never knows which one it is talking to.
 */
export interface VideoGenerator {
  readonly name: string;
  generate(request: VideoRequest): Promise<GeneratedVideo>;
}

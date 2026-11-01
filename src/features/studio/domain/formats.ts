/** How the product appears in the video. The ids are stored in the database; never rename them. */
export const VIDEO_FORMATS = ["hands", "point-of-view", "scene"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const DEFAULT_VIDEO_FORMAT: VideoFormat = "hands";

export const VIDEO_FORMAT_TEXT: Readonly<
  Record<VideoFormat, { label: string; description: string }>
> = {
  hands: {
    label: "Mãos mostrando",
    description: "O produto sendo usado. Só as mãos aparecem.",
  },
  "point-of-view": {
    label: "Do seu ponto de vista",
    description: "Como se você estivesse usando, sem mostrar o rosto.",
  },
  scene: {
    label: "No ambiente",
    description: "O produto num cantinho da casa, sem pessoas.",
  },
};

export function isVideoFormat(value: unknown): value is VideoFormat {
  return VIDEO_FORMATS.some((format) => format === value);
}

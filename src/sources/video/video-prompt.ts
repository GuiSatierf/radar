import type { VideoFormat } from "@/features/studio/domain/formats";

// Shopee names are long lists of keywords; the start says what the product is.
const MAX_PRODUCT_NAME_LENGTH = 120;

const FORMAT_SCENE: Readonly<Record<VideoFormat, string>> = {
  hands:
    "Only a person's hands appear, holding the product and showing it in use. No face.",
  "point-of-view":
    "First-person point of view, as if the viewer were using the product. No face appears.",
  scene:
    "The product sits in a tidy, well-lit corner of a home, with a slow camera move around it. No people.",
};

// Video models garble letters, so text stays out; the person adds voice or music later.
const SHARED_RULES = [
  "Vertical short video for selling on social media.",
  "Realistic look, natural light, steady and smooth camera.",
  "No on-screen text, captions, logos or watermarks.",
  "No speech or narration; only quiet natural ambient sound.",
].join(" ");

/** Collapses whitespace and cuts the name to its first words. */
function cleanProductName(name: string): string {
  const singleLine = name.replace(/\s+/g, " ").trim();

  if (singleLine.length <= MAX_PRODUCT_NAME_LENGTH) return singleLine;

  return `${singleLine.slice(0, MAX_PRODUCT_NAME_LENGTH).trimEnd()}…`;
}

/**
 * Writes the instruction a video AI gets for one Studio video.
 *
 * @param input.productName - The product name as it came from the store.
 * @param input.format - How the product appears (hands, point of view or scene).
 * @param input.hasPhoto - Whether the product photo goes along; then the AI must keep it faithful.
 * @returns A single-paragraph prompt in English, which video models follow best.
 */
export function buildVideoPrompt(input: {
  productName: string;
  format: VideoFormat;
  hasPhoto: boolean;
}): string {
  const product = cleanProductName(input.productName);
  const subject = input.hasPhoto
    ? `The product is "${product}", shown in the reference photo. Keep its shape, colors and details exactly as in the photo.`
    : `The product is "${product}".`;

  return `${subject} ${FORMAT_SCENE[input.format]} ${SHARED_RULES}`;
}

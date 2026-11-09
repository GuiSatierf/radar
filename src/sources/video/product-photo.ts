const PHOTO_TIMEOUT_IN_MS = 20_000;
// Store photos are well under this; anything bigger is not a product photo.
export const MAX_PHOTO_BYTES = 7 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoMimeType = (typeof ACCEPTED_TYPES)[number];

export interface ProductPhoto {
  readonly base64: string;
  readonly mimeType: PhotoMimeType;
}

export class ProductPhotoError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(`product photo could not be used: ${reason}`, options);
    this.name = "ProductPhotoError";
  }
}

function readPhotoType(contentType: string | null): PhotoMimeType | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();

  return ACCEPTED_TYPES.find((accepted) => accepted === type) ?? null;
}

/**
 * Downloads a product photo to send along to the video AI.
 *
 * @param url - The photo address saved with the product; only https is fetched.
 * @param fetchImpl - The fetch to use (the tests pass a fake one).
 * @returns The photo in base64 with its type.
 * @throws {ProductPhotoError} When the address is not https, the store answers with an error,
 * the file is not a JPEG, PNG or WebP image, or it is larger than 7 MB.
 */
export async function downloadProductPhoto(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProductPhoto> {
  if (URL.canParse(url) === false || new URL(url).protocol !== "https:") {
    throw new ProductPhotoError("the address is not https");
  }

  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(PHOTO_TIMEOUT_IN_MS),
  });

  if (response.ok === false) {
    throw new ProductPhotoError(`the store answered ${response.status}`);
  }

  const mimeType = readPhotoType(response.headers.get("content-type"));

  if (mimeType == null) {
    throw new ProductPhotoError("the file is not a JPEG, PNG or WebP image");
  }

  const declaredSize = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredSize) && declaredSize > MAX_PHOTO_BYTES) {
    throw new ProductPhotoError(`the photo has ${declaredSize} bytes`);
  }

  const bytes = await readUpToLimit(response);

  if (bytes.byteLength === 0) {
    throw new ProductPhotoError("the photo has 0 bytes");
  }

  return { base64: bytes.toString("base64"), mimeType };
}

/** Reads the body but stops as soon as it passes the limit, so a huge file is never held whole. */
async function readUpToLimit(response: Response): Promise<Buffer> {
  if (response.body == null) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) return Buffer.concat(chunks);

    total += value.byteLength;

    if (total > MAX_PHOTO_BYTES) {
      await reader.cancel();

      throw new ProductPhotoError(
        `the photo has more than ${MAX_PHOTO_BYTES} bytes`,
      );
    }

    chunks.push(value);
  }
}

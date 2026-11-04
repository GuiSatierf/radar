import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
// Bumped if the format ever changes, so old rows can still be told apart.
const FORMAT_PREFIX = "v1:";

export class UnreadableVideoKeyError extends Error {
  constructor(reason: string) {
    super(`stored video AI key could not be read: ${reason}`);
    this.name = "UnreadableVideoKeyError";
  }
}

/** The secret is random and long (VIDEO_KEYS_SECRET), so one SHA-256 gives the 32-byte AES key. */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts an API key for the database with AES-256-GCM.
 *
 * @param plainKey - The key as the admin pasted it.
 * @param secret - VIDEO_KEYS_SECRET.
 * @returns "v1:" followed by the IV, the auth tag and the ciphertext, in base64.
 */
export function encryptVideoKey(plainKey: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainKey, "utf8"),
    cipher.final(),
  ]);

  return `${FORMAT_PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64")}`;
}

/**
 * Reads back a key saved by encryptVideoKey.
 *
 * @param stored - The value from the database.
 * @param secret - VIDEO_KEYS_SECRET; must be the one used to encrypt.
 * @returns The plain API key.
 * @throws {UnreadableVideoKeyError} When the format is unknown, the data is cut short, or the
 * secret changed (the auth tag no longer matches).
 */
export function decryptVideoKey(stored: string, secret: string): string {
  if (stored.startsWith(FORMAT_PREFIX) === false) {
    throw new UnreadableVideoKeyError("unknown format");
  }

  const packed = Buffer.from(stored.slice(FORMAT_PREFIX.length), "base64");

  if (packed.length <= IV_BYTES + TAG_BYTES) {
    throw new UnreadableVideoKeyError("too short");
  }

  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    throw new UnreadableVideoKeyError(
      error instanceof Error ? error.message : "decryption failed",
    );
  }
}

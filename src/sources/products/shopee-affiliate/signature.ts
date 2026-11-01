import { createHash } from "node:crypto";

/**
 * Shopee Affiliate Open API authorization header. Format taken from third-party SDKs (the
 * official docs need an affiliate login): SHA256 of AppId + Timestamp + Payload + Secret, where
 * Payload is the exact request body. Confirm against the official docs when the key arrives.
 */
export function buildAuthorizationHeader(input: {
  appId: string;
  secret: string;
  timestampSeconds: number;
  payload: string;
}): string {
  const signature = createHash("sha256")
    .update(
      `${input.appId}${input.timestampSeconds}${input.payload}${input.secret}`,
    )
    .digest("hex");

  return `SHA256 Credential=${input.appId}, Timestamp=${input.timestampSeconds}, Signature=${signature}`;
}

import type { ShopeeCredentials } from "./client";

export class IncompleteShopeeCredentialsError extends Error {
  constructor() {
    super(
      "Set both SHOPEE_AFFILIATE_APP_ID and SHOPEE_AFFILIATE_SECRET, or neither.",
    );
    this.name = "IncompleteShopeeCredentialsError";
  }
}

function present(value: string | undefined): string | null {
  if (value == null) return null;

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The key is optional: without it the app keeps the fake catalog. Half a key is a mistake worth
 * failing loudly on, rather than silently running without the real source.
 */
export function readShopeeCredentials(
  source: Readonly<Record<string, string | undefined>>,
): ShopeeCredentials | null {
  const appId = present(source.SHOPEE_AFFILIATE_APP_ID);
  const secret = present(source.SHOPEE_AFFILIATE_SECRET);

  if (appId == null && secret == null) return null;

  if (appId == null || secret == null)
    throw new IncompleteShopeeCredentialsError();

  return { appId, secret };
}

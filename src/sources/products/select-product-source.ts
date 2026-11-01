import { createFakeProductSource } from "./fake-product-source";
import type { ProductSource } from "./product-source";
import { createShopeeAffiliateClient } from "./shopee-affiliate/client";
import { readShopeeCredentials } from "./shopee-affiliate/credentials";
import { createShopeeProductSource } from "./shopee-affiliate/shopee-product-source";

/**
 * The real Shopee catalog when the affiliate key is set, the fictitious one otherwise (local
 * machines without the key, tests). Half a key throws instead of quietly using the fake catalog.
 */
export function selectProductSource(
  env: Readonly<Record<string, string | undefined>>,
): ProductSource {
  const credentials = readShopeeCredentials(env);

  if (credentials == null) return createFakeProductSource();

  return createShopeeProductSource({
    client: createShopeeAffiliateClient({ credentials }),
  });
}

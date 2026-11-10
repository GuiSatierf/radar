import { logger } from "@/lib/logger";
import type {
  FetchProductsInput,
  ProductSnapshot,
  ProductSource,
} from "../product-source";
import { SHOPEE_CATEGORIES, type ShopeeCategory } from "./categories";
import type { ShopeeAffiliateClient } from "./client";
import type { ShopeeOffer } from "./response";

export const SHOPEE_PRODUCT_SOURCE_NAME = "shopee-affiliate";

/** 2 pages of 50 per category: about 2,800 products in about 56 calls. */
export const DEFAULT_PAGES_PER_CATEGORY = 2;

// The scheduled task in Coolify stops after 300 s; this leaves a minute to save the catalog.
const DEFAULT_BUDGET_IN_MS = 240_000;

// Our limits (product-source.ts); a long Shopee title is cut instead of losing the product.
const MAX_NAME_LENGTH = 200;
const MAX_SHOP_NAME_LENGTH = 100;
const CHRISTMAS = /natal/i;

/**
 * The fields the API does not have stay empty, never guessed: no affiliate count (the robot will
 * bring it), no rating count, stock, free sample or videos.
 */
export function offerToSnapshot(
  offer: ShopeeOffer,
  category: ShopeeCategory,
): ProductSnapshot {
  return {
    id: `shopee-${offer.itemId}`,
    name: offer.name.slice(0, MAX_NAME_LENGTH),
    categorySlug: category.slug,
    categoryLabel: category.label,
    shopName: offer.shopName.slice(0, MAX_SHOP_NAME_LENGTH),
    // The product page, never `affiliateUrl`: that link pays the key owner, not the subscriber.
    productUrl: offer.productUrl,
    imageUrls: offer.imageUrl == null ? [] : [offer.imageUrl],
    priceCents: offer.priceCents,
    priceMaxCents: Math.max(offer.priceMaxCents, offer.priceCents),
    sellerRateBasisPoints: offer.sellerRateBasisPoints,
    ratingTenths: offer.ratingTenths,
    ratingCount: null,
    monthlySales: offer.sales,
    stock: null,
    affiliateCount: null,
    affiliateCountIsMinimum: false,
    hasFreeSample: false,
    seasonalTags: CHRISTMAS.test(offer.name) ? ["natal"] : [],
    videos: [],
  };
}

// The time budget rarely reaches every category while Shopee is slow, so the ones refreshed
// longest ago (never collected first) go first and every category gets its turn.
function oldestFirst(
  categories: readonly ShopeeCategory[],
  lastCollectedAtByCategory: ReadonlyMap<string, Date>,
): ShopeeCategory[] {
  const lastTime = (category: ShopeeCategory): number =>
    lastCollectedAtByCategory.get(category.slug)?.getTime() ?? 0;

  return categories.toSorted(
    (first, second) => lastTime(first) - lastTime(second),
  );
}

/**
 * The best sellers of each category. Categories run one after another to stay well under the
 * API's rate limit. A category that still fails after the client's retries is skipped, and the
 * collector keeps its products, because the API fails at random calls and one of them must not
 * hold back the whole catalog. Categories left when the time budget runs out are skipped the same
 * way, so the retries never push the run past the scheduled task's timeout. When nothing came
 * back and some category failed, the first error is thrown.
 */
export function createShopeeProductSource(input: {
  client: Pick<ShopeeAffiliateClient, "fetchOffers">;
  pagesPerCategory?: number;
  categories?: readonly ShopeeCategory[];
  budgetInMs?: number;
  clockInMs?: () => number;
}): ProductSource {
  const pagesPerCategory = input.pagesPerCategory ?? DEFAULT_PAGES_PER_CATEGORY;
  const categories = input.categories ?? SHOPEE_CATEGORIES;
  const budgetInMs = input.budgetInMs ?? DEFAULT_BUDGET_IN_MS;
  const clockInMs = input.clockInMs ?? Date.now;

  async function fetchCategory(
    category: ShopeeCategory,
  ): Promise<ShopeeOffer[]> {
    const { offers } = await input.client.fetchOffers({
      categoryId: category.id,
      sort: "mostSold",
      maxPages: pagesPerCategory,
    });

    return offers;
  }

  async function fetchProducts(
    fetchInput?: FetchProductsInput,
  ): Promise<ProductSnapshot[]> {
    const byId = new Map<string, ProductSnapshot>();
    const failures: unknown[] = [];
    const startedAt = clockInMs();
    const ordered = oldestFirst(
      categories,
      fetchInput?.lastCollectedAtByCategory ?? new Map(),
    );

    for (const [index, category] of ordered.entries()) {
      if (clockInMs() - startedAt >= budgetInMs) {
        logger.warn(
          { skippedCategories: categories.length - index },
          "shopee collection ran out of time; the rest keep their products",
        );
        break;
      }

      const offers = await fetchCategory(category).catch((error: unknown) => {
        failures.push(error);
        logger.warn(
          { err: error, category: category.slug },
          "shopee category failed; its products are kept",
        );
        return [];
      });

      for (const offer of offers) {
        const snapshot = offerToSnapshot(offer, category);
        byId.set(snapshot.id, byId.get(snapshot.id) ?? snapshot);
      }
    }

    if (byId.size === 0 && failures.length > 0) throw failures[0];

    return [...byId.values()];
  }

  return { name: SHOPEE_PRODUCT_SOURCE_NAME, fetchProducts };
}

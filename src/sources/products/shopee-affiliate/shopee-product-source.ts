import type { ProductSnapshot, ProductSource } from "../product-source";
import { SHOPEE_CATEGORIES, type ShopeeCategory } from "./categories";
import type { ShopeeAffiliateClient } from "./client";
import type { ShopeeOffer } from "./response";

export const SHOPEE_PRODUCT_SOURCE_NAME = "shopee-affiliate";

/** 2 pages of 50 per category: about 2,800 products in about 56 calls. */
export const DEFAULT_PAGES_PER_CATEGORY = 2;

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

/**
 * The best sellers of each category. Categories run one after another to stay well under the
 * API's rate limit, and any failure stops the whole collection: a partial catalog would remove
 * the categories that failed.
 */
export function createShopeeProductSource(input: {
  client: Pick<ShopeeAffiliateClient, "fetchOffers">;
  pagesPerCategory?: number;
  categories?: readonly ShopeeCategory[];
}): ProductSource {
  const pagesPerCategory = input.pagesPerCategory ?? DEFAULT_PAGES_PER_CATEGORY;
  const categories = input.categories ?? SHOPEE_CATEGORIES;

  async function fetchProducts(): Promise<ProductSnapshot[]> {
    const byId = new Map<string, ProductSnapshot>();

    for (const category of categories) {
      const { offers } = await input.client.fetchOffers({
        categoryId: category.id,
        sort: "mostSold",
        maxPages: pagesPerCategory,
      });

      for (const offer of offers) {
        const snapshot = offerToSnapshot(offer, category);
        byId.set(snapshot.id, byId.get(snapshot.id) ?? snapshot);
      }
    }

    return [...byId.values()];
  }

  return { name: SHOPEE_PRODUCT_SOURCE_NAME, fetchProducts };
}

import { z } from "zod";

/**
 * The single seam between the app and wherever product data comes from (fake data, the Shopee
 * affiliate API, a paid provider). Screens never see a source, only our database.
 */
const MAX_VIDEOS = 10;

const videoSchema = z.object({
  rank: z.int().min(1).max(MAX_VIDEOS),
  creatorHandle: z.string().trim().min(1).max(60),
  views: z.int().min(0),
  caption: z.string().trim().max(300).nullable(),
  videoUrl: z.url().nullable(),
});

export const productSnapshotSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    name: z.string().trim().min(1).max(200),
    categorySlug: z.string().regex(/^[a-z0-9-]{1,60}$/),
    categoryLabel: z.string().trim().min(1).max(60),
    shopName: z.string().trim().min(1).max(100),
    productUrl: z.url({ protocol: /^https$/ }),
    imageUrls: z.array(z.url({ protocol: /^https$/ })).max(12),
    priceCents: z.int().positive(),
    priceMaxCents: z.int().positive(),
    sellerRateBasisPoints: z.int().min(0).max(10_000),
    ratingTenths: z.int().min(0).max(50).nullable(),
    ratingCount: z.int().min(0).nullable(),
    monthlySales: z.int().min(0),
    stock: z.int().min(0).nullable(),
    // Null when the source does not know how many affiliates promote the product.
    affiliateCount: z.int().min(0).nullable(),
    affiliateCountIsMinimum: z.boolean(),
    hasFreeSample: z.boolean(),
    seasonalTags: z.array(z.enum(["natal"])),
    videos: z.array(videoSchema).max(MAX_VIDEOS),
  })
  .refine((product) => product.priceMaxCents >= product.priceCents, {
    message: "priceMaxCents must be >= priceCents",
  });

export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;

export interface ProductSource {
  readonly name: string;
  /** Everything the source has now. Returned as unknown: the collector validates it. */
  fetchProducts(): Promise<readonly unknown[]>;
}

import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Products as the collector last saw them. Screens read only this table, never Shopee directly.
 * Money in integer cents, rates in basis points (1% = 100), rating in tenths (4.9 = 49).
 */
export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    categorySlug: text("category_slug").notNull(),
    categoryLabel: text("category_label").notNull(),
    shopName: text("shop_name").notNull(),
    productUrl: text("product_url").notNull(),
    imageUrls: text("image_urls").array().notNull().default([]),
    priceCents: integer("price_cents").notNull(),
    priceMaxCents: integer("price_max_cents").notNull(),
    sellerRateBasisPoints: integer("seller_rate_basis_points")
      .notNull()
      .default(0),
    ratingTenths: integer("rating_tenths"),
    ratingCount: integer("rating_count"),
    monthlySales: integer("monthly_sales").notNull().default(0),
    stock: integer("stock"),
    // Null until we count who promotes the product (the Shopee affiliate API does not say).
    affiliateCount: integer("affiliate_count"),
    // Shopee sometimes shows "10+": the real number is at least affiliateCount.
    affiliateCountIsMinimum: boolean("affiliate_count_is_minimum")
      .notNull()
      .default(false),
    hasFreeSample: boolean("has_free_sample").notNull().default(false),
    seasonalTags: text("seasonal_tags").array().notNull().default([]),
    opportunityScore: integer("opportunity_score").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("product_affiliate_count_idx").on(table.affiliateCount),
    index("product_monthly_sales_idx").on(table.monthlySales),
    index("product_category_slug_idx").on(table.categorySlug),
  ],
);

/** The most-viewed videos of each product, in the order the source ranked them. */
export const productVideo = pgTable(
  "product_video",
  {
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    creatorHandle: text("creator_handle").notNull(),
    views: integer("views").notNull(),
    caption: text("caption"),
    videoUrl: text("video_url"),
  },
  (table) => [primaryKey({ columns: [table.productId, table.rank] })],
);

/**
 * Monthly sales of each product on each collection day (Brazil calendar day), so Rankings can
 * show what grew. No foreign key: a product that leaves the catalog for a day keeps its history.
 */
export const productSalesDay = pgTable(
  "product_sales_day",
  {
    productId: text("product_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    monthlySales: integer("monthly_sales").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.day] }),
    index("product_sales_day_day_idx").on(table.day),
  ],
);

import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { product } from "./radar-schema";

/**
 * Ads from the Meta ad library, curated by an admin or collected from an automatic source. We keep
 * the ad id, never the video or image: the screen links back to the library.
 */
export const ad = pgTable(
  "ad",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // From the library link; the link we show is rebuilt from it.
    libraryAdId: text("library_ad_id").notNull().unique(),
    advertiserName: text("advertiser_name").notNull(),
    adText: text("ad_text").notNull().default(""),
    // AdPlatform values from src/features/ads/domain/ads.ts.
    platforms: text("platforms").array().notNull().default([]),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    // The last day someone checked that the ad was still running.
    lastSeenOn: date("last_seen_on", { mode: "string" }).notNull(),
    // Our catalog product, when the ad sells one we have. Kept when a product leaves the catalog.
    productId: text("product_id").references(() => product.id, {
      onDelete: "set null",
    }),
    // The Shopee link as pasted (without tracking), for products outside our catalog.
    productUrl: text("product_url"),
    // "manual" (added in the admin) or the name of the automatic source that found it.
    source: text("source").notNull().default("manual"),
    // False when the source no longer finds the ad running; manual ads stay active.
    isActive: boolean("is_active").notNull().default(true),
    // Hidden by an admin (e.g. a supermarket ad); collections never unhide it.
    isHidden: boolean("is_hidden").notNull().default(false),
    // True once an admin wrote the content (manual ads, or an automatic ad they edited):
    // collections then only update when it was seen and whether it still runs.
    isCurated: boolean("is_curated").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("ad_product_id_idx").on(table.productId),
    index("ad_source_idx").on(table.source),
  ],
);

import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * How the Studio makes videos, set by an admin: a single row. Without it the Studio keeps its
 * default limit and the sample video.
 */
export const videoSettings = pgTable(
  "video_settings",
  {
    id: integer("id").primaryKey().default(1),
    // Videos each person makes per period; zero turns the Studio off.
    limitCount: integer("limit_count").notNull(),
    // "day", "week" or "month", counted in Brazil time.
    limitPeriod: text("limit_period").notNull(),
    // The video AI in use (a provider and one of its models); null keeps the sample video.
    provider: text("provider"),
    model: text("model"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("video_settings_single_row", sql`${table.id} = 1`),
    check("video_settings_limit_count", sql`${table.limitCount} >= 0`),
  ],
);

/**
 * The API key of each video AI service, encrypted with VIDEO_KEYS_SECRET (AES-256-GCM), so the
 * database alone never reveals a key.
 */
export const videoProviderKey = pgTable("video_provider_key", {
  provider: text("provider").primaryKey(),
  keyCiphertext: text("key_ciphertext").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

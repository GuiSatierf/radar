import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Videos made in the Studio. Each row is a queue item first ("queued", then "generating") and a
 * library item after ("ready" or "failed"). Rows stay after the video expires, because every
 * video made this month still counts toward the plan's monthly limit.
 */
export const studioVideo = pgTable(
  "studio_video",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // No foreign key: the product may leave the catalog, so its name and photo are copied here.
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    productImageUrl: text("product_image_url"),
    format: text("format").notNull(),
    // "queued", "generating", "ready", "failed" or "expired".
    status: text("status").notNull().default("queued"),
    videoUrl: text("video_url"),
    // Error class and a short message; never personal data.
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("studio_video_user_created_idx").on(table.userId, table.createdAt),
    index("studio_video_status_created_idx").on(table.status, table.createdAt),
    // One video at a time per person, enforced by the database even when two clicks race.
    uniqueIndex("studio_video_one_active_per_user_idx")
      .on(table.userId)
      .where(sql`${table.status} in ('queued', 'generating')`),
  ],
);

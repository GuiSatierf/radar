import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** One row per product collection, so the admin can see when it last ran and whether it worked. */
export const collectionRun = pgTable("collection_run", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // What was collected: "products" or "ads".
  kind: text("kind").notNull().default("products"),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  // "ok" or "error".
  status: text("status").notNull(),
  saved: integer("saved").default(0).notNull(),
  skipped: integer("skipped").default(0).notNull(),
  removed: integer("removed").default(0).notNull(),
  removalSkipped: boolean("removal_skipped").default(false).notNull(),
  // Error class and a short message; never personal data.
  errorMessage: text("error_message"),
});

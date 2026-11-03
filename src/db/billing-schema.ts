import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * What each Hotmart purchase gives, per buyer e-mail and Hotmart product. Kept by e-mail, not by
 * account, because people often buy before they sign up. Access lasts while `endsAt` is null or
 * in the future.
 */
export const hotmartAccess = pgTable(
  "hotmart_access",
  {
    email: text("email").notNull(),
    productId: text("product_id").notNull(),
    plan: text("plan").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // Set once the daily task has applied an ended access to the account, so it runs once.
    endApplied: boolean("end_applied").notNull().default(false),
    // Hotmart may deliver events out of order: an older event never overwrites a newer one.
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.email, table.productId] })],
);

/**
 * Plans an admin unlocks by e-mail (lowercase), for people who do not buy on Hotmart, such as the
 * students in a free test. Like a purchase, it waits for the sign-up when there is no account yet.
 */
export const accessGrant = pgTable("access_grant", {
  email: text("email").primaryKey(),
  plan: text("plan").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Every Hotmart event received, by Hotmart's id, so a retried event is applied only once. */
export const hotmartEvent = pgTable("hotmart_event", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // "applied", "ignored" or "received" (kept while plans are not unlocked automatically).
  outcome: text("outcome").notNull(),
  // Why it was ignored; never personal data.
  detail: text("detail"),
});

/**
 * The Hotmart connection an admin sets up: a single row. The code Hotmart sends with each event
 * (hottok) is kept only as its SHA-256, so the database never holds the code itself.
 */
export const hotmartSettings = pgTable(
  "hotmart_settings",
  {
    id: integer("id").primaryKey().default(1),
    hottokHash: text("hottok_hash").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When an admin turned on unlocking plans from purchases; null while it is off.
    unlocksPlansAt: timestamp("unlocks_plans_at", { withTimezone: true }),
  },
  (table) => [check("hotmart_settings_single_row", sql`${table.id} = 1`)],
);

/** Which Hotmart subscription plan ("plano") or product ("produto") unlocks which of our plans. */
export const hotmartPlanMapping = pgTable(
  "hotmart_plan_mapping",
  {
    kind: text("kind").notNull(),
    hotmartId: text("hotmart_id").notNull(),
    plan: text("plan").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.hotmartId] })],
);

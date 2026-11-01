import { eq } from "drizzle-orm";
import type { Database } from "../../src/db/client";
import { user } from "../../src/db/schema";
import { ADMIN_ROLE } from "../../src/features/plans/access";
import type { PlanId } from "../../src/features/plans/plans";

export type AccessChange = "changed" | "account-not-found" | "skipped";

/** Better Auth stores e-mails trimmed and lowercased; match them the same way. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Makes an existing account admin. It never creates one: the person signs up first, then the
 * e-mail goes into ADMIN_EMAIL. Same rule as the container start (scripts/start.mjs).
 */
export async function grantAdminRole(
  db: Database,
  email: string | undefined,
): Promise<AccessChange> {
  if (email == null || email.trim().length === 0) return "skipped";

  const updated = await db
    .update(user)
    .set({ role: ADMIN_ROLE })
    .where(eq(user.email, normalizeEmail(email)))
    .returning({ id: user.id });

  return updated.length === 0 ? "account-not-found" : "changed";
}

/** For the demo account and the browser tests; in the app, only an admin changes a plan. */
export async function setPlanByEmail(
  db: Database,
  email: string,
  plan: PlanId,
): Promise<AccessChange> {
  const updated = await db
    .update(user)
    .set({ plan })
    .where(eq(user.email, normalizeEmail(email)))
    .returning({ id: user.id });

  return updated.length === 0 ? "account-not-found" : "changed";
}

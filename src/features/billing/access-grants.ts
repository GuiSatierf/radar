import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accessGrant, user } from "@/db/schema";
import type { PlanId } from "@/features/plans/plans";
import { syncAccountPlan, toPlanId } from "./access";

export interface AccessGrantRow {
  readonly email: string;
  readonly plan: PlanId;
  readonly createdAt: Date;
  readonly hasAccount: boolean;
}

/**
 * Unlocks the plan for each e-mail (already lowercase). Accounts with a confirmed e-mail change now;
 * the others get it when their owner confirms the e-mail. Granting an e-mail again changes its plan.
 */
export async function grantAccess(
  db: Database,
  input: { emails: readonly string[]; plan: PlanId },
  now: Date,
): Promise<void> {
  if (input.emails.length === 0) return;

  await db.transaction(async (tx) => {
    await tx
      .insert(accessGrant)
      .values(
        input.emails.map((email) => ({
          email,
          plan: input.plan,
          createdAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: accessGrant.email,
        set: { plan: input.plan },
      });

    for (const email of input.emails) await syncAccountPlan(tx, email, now);
  });
}

/** The account goes back to its Hotmart plan, or to no plan. False when the e-mail had no grant. */
export async function revokeAccess(
  db: Database,
  email: string,
  now: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(accessGrant)
      .where(eq(accessGrant.email, email))
      .returning({ email: accessGrant.email });

    if (removed.length === 0) return false;

    await syncAccountPlan(tx, email, now);

    return true;
  });
}

/** Newest first, with whether that person already created the account. */
export async function listAccessGrants(
  db: Database,
): Promise<AccessGrantRow[]> {
  const rows = await db
    .select({
      email: accessGrant.email,
      plan: accessGrant.plan,
      createdAt: accessGrant.createdAt,
      // A join, not a subquery: drizzle qualifies columns with their table only when it joins.
      hasAccount: sql<boolean>`${user.id} is not null`,
    })
    .from(accessGrant)
    .leftJoin(user, eq(sql`lower(${user.email})`, accessGrant.email))
    .orderBy(desc(accessGrant.createdAt), accessGrant.email);

  return rows.map((row) => ({ ...row, plan: toPlanId(row.plan) }));
}

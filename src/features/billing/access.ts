import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { accessGrant, hotmartAccess, user } from "@/db/schema";
import { DEFAULT_PLAN, PLAN_IDS, type PlanId } from "@/features/plans/plans";
import type { AccessChange } from "./hotmart/events";

type Executor = Pick<Database, "select" | "insert" | "update">;
type Change = Exclude<AccessChange, { kind: "ignore" }>;

/** PLAN_IDS goes from no plan to the biggest one, so a later index is a better plan. */
function rank(plan: string): number {
  const ids: readonly string[] = PLAN_IDS;

  return ids.indexOf(plan);
}

export function toPlanId(plan: string | undefined): PlanId {
  return PLAN_IDS.find((id) => id === plan) ?? DEFAULT_PLAN;
}

function isRunning(now: Date) {
  return or(isNull(hotmartAccess.endsAt), gt(hotmartAccess.endsAt, now));
}

/**
 * The best plan among the purchases still running for this e-mail and the plan an admin unlocked
 * for it; "none" without any.
 */
export async function effectivePlan(
  db: Executor,
  email: string,
  now: Date,
): Promise<PlanId> {
  const [purchases, grants] = await Promise.all([
    db
      .select({ plan: hotmartAccess.plan })
      .from(hotmartAccess)
      .where(and(eq(hotmartAccess.email, email), isRunning(now))),
    db
      .select({ plan: accessGrant.plan })
      .from(accessGrant)
      .where(eq(accessGrant.email, email)),
  ]);

  const best = [...purchases, ...grants]
    .map((row) => row.plan)
    .toSorted((a, b) => rank(b) - rank(a))[0];

  return toPlanId(best);
}

export interface RunningAccess {
  readonly plan: PlanId;
  // When a cancelled subscription stops; null while it renews.
  readonly endsAt: Date | null;
}

/** No end beats any end, and a later end beats an earlier one. */
function endsLater(a: Date | null, b: Date | null): boolean {
  if (a == null) return b != null;

  if (b == null) return false;

  return a > b;
}

function isBetter(candidate: RunningAccess, current: RunningAccess): boolean {
  const byPlan = rank(candidate.plan) - rank(current.plan);

  if (byPlan !== 0) return byPlan > 0;

  return endsLater(candidate.endsAt, current.endsAt);
}

/** The best running purchase per e-mail (lowercase), for the admin's account list. */
export async function listRunningAccess(
  db: Executor,
  emails: readonly string[],
  now: Date,
): Promise<ReadonlyMap<string, RunningAccess>> {
  if (emails.length === 0) return new Map();

  const rows = await db
    .select({
      email: hotmartAccess.email,
      plan: hotmartAccess.plan,
      endsAt: hotmartAccess.endsAt,
    })
    .from(hotmartAccess)
    .where(and(inArray(hotmartAccess.email, [...emails]), isRunning(now)));

  const best = new Map<string, RunningAccess>();

  for (const row of rows) {
    const candidate = { plan: toPlanId(row.plan), endsAt: row.endsAt };
    const current = best.get(row.email);

    if (current == null || isBetter(candidate, current))
      best.set(row.email, candidate);
  }

  return best;
}

/**
 * Writes the e-mail's plan on its account, if one exists and its owner confirmed the e-mail
 * (confirming runs this again). Without the confirmation, anyone who signed up with a buyer's
 * e-mail would get the buyer's plan.
 */
export async function syncAccountPlan(
  db: Executor,
  email: string,
  now: Date,
): Promise<void> {
  const plan = await effectivePlan(db, email, now);

  await db
    .update(user)
    .set({ plan })
    .where(
      and(eq(sql`lower(${user.email})`, email), eq(user.emailVerified, true)),
    );
}

/** Records one grant or end. An event older than the last one applied to that purchase is dropped. */
export async function applyAccessChange(
  db: Executor,
  change: Change,
): Promise<void> {
  const isNewer = lte(hotmartAccess.lastEventAt, change.at);

  if (change.kind === "grant") {
    // Only a payment renews access; a completed purchase or a plan switch after a cancellation
    // must keep the end it set, or the subscriber would keep the plan forever.
    const renewal = change.renewsAccess
      ? { endsAt: null, endApplied: false }
      : {};

    await db
      .insert(hotmartAccess)
      .values({
        email: change.email,
        productId: change.productId,
        plan: change.plan,
        endsAt: null,
        lastEventAt: change.at,
      })
      .onConflictDoUpdate({
        target: [hotmartAccess.email, hotmartAccess.productId],
        set: {
          plan: change.plan,
          ...renewal,
          lastEventAt: change.at,
          updatedAt: new Date(),
        },
        setWhere: isNewer,
      });
    return;
  }

  // Kept even for a purchase we never saw: a refund that arrives before its (older) approval
  // must still win when the approval shows up later.
  await db
    .insert(hotmartAccess)
    .values({
      email: change.email,
      productId: change.productId,
      plan: DEFAULT_PLAN,
      endsAt: change.endsAt,
      lastEventAt: change.at,
    })
    .onConflictDoUpdate({
      target: [hotmartAccess.email, hotmartAccess.productId],
      set: {
        endsAt: change.endsAt,
        endApplied: false,
        lastEventAt: change.at,
        updatedAt: new Date(),
      },
      setWhere: isNewer,
    });
}

function endedAndPending(now: Date) {
  return and(
    lte(hotmartAccess.endsAt, now),
    eq(hotmartAccess.endApplied, false),
  );
}

/**
 * Daily: purchases whose paid period is over (after a cancellation) lose access on the account.
 * Each one is applied once, so a plan the admin gives by hand later is not undone every day.
 * The "applied" mark and the account change commit together per e-mail: if one fails, that
 * e-mail stays pending and the next run retries it.
 */
export async function applyEndedAccess(
  db: Database,
  now: Date,
): Promise<number> {
  const pending = await db
    .selectDistinct({ email: hotmartAccess.email })
    .from(hotmartAccess)
    .where(endedAndPending(now));
  let applied = 0;

  for (const { email } of pending) {
    const changed = await db.transaction(async (tx) => {
      const marked = await tx
        .update(hotmartAccess)
        .set({ endApplied: true })
        .where(and(eq(hotmartAccess.email, email), endedAndPending(now)))
        .returning({ email: hotmartAccess.email });

      // Another run got here first: nothing left to apply for this e-mail.
      if (marked.length === 0) return false;

      await syncAccountPlan(tx, email, now);

      return true;
    });

    if (changed) applied += 1;
  }

  return applied;
}

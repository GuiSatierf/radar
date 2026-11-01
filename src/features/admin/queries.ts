import { count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import { collectionRun, hotmartEvent, user } from "@/db/schema";
import { ADMIN_ROLE } from "@/features/plans/access";
import { DEFAULT_PLAN, isPlanId, type PlanId } from "@/features/plans/plans";
import { containsPattern } from "@/lib/like-pattern";
import type { CollectionKind } from "@/sources/record-run";

export const ADMIN_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

export interface AdminUserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly plan: PlanId;
  readonly isBlocked: boolean;
  readonly isAdmin: boolean;
  readonly createdAt: Date;
}

export interface LastCollection {
  readonly finishedAt: Date;
  readonly source: string;
  readonly isOk: boolean;
  readonly saved: number;
  readonly errorMessage: string | null;
}

function searchCondition(search: string): SQL | undefined {
  const term = search.trim().slice(0, MAX_SEARCH_LENGTH);

  if (term.length === 0) return undefined;

  const pattern = containsPattern(term);

  return or(ilike(user.name, pattern), ilike(user.email, pattern));
}

/** Newest accounts first; the search looks at the name and the e-mail. */
export async function listUsersForAdmin(input: {
  db: Database;
  search: string;
}): Promise<{ items: AdminUserRow[]; total: number }> {
  const where = searchCondition(input.search);

  const [rows, [totals]] = await Promise.all([
    input.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        banned: user.banned,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt), user.id)
      .limit(ADMIN_PAGE_SIZE),
    input.db.select({ total: count() }).from(user).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      plan: isPlanId(row.plan) ? row.plan : DEFAULT_PLAN,
      isBlocked: row.banned === true,
      isAdmin: row.role === ADMIN_ROLE,
      createdAt: row.createdAt,
    })),
    total: totals?.total ?? 0,
  };
}

export async function countUsers(
  db: Database,
): Promise<{ total: number; blocked: number }> {
  const [[all], [blocked]] = await Promise.all([
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(user).where(eq(user.banned, true)),
  ]);

  return { total: all?.total ?? 0, blocked: blocked?.total ?? 0 };
}

export const HOTMART_EVENTS_SHOWN = 50;

export interface HotmartEventRow {
  readonly id: string;
  readonly event: string;
  readonly receivedAt: Date;
  readonly outcome: string;
  readonly detail: string | null;
}

/** The newest Hotmart notices. They hold no e-mail on purpose, only what happened. */
export async function listRecentHotmartEvents(
  db: Database,
): Promise<HotmartEventRow[]> {
  return db
    .select({
      id: hotmartEvent.id,
      event: hotmartEvent.event,
      receivedAt: hotmartEvent.receivedAt,
      outcome: hotmartEvent.outcome,
      detail: hotmartEvent.detail,
    })
    .from(hotmartEvent)
    .orderBy(desc(hotmartEvent.receivedAt), hotmartEvent.id)
    .limit(HOTMART_EVENTS_SHOWN);
}

export async function getLastCollection(
  db: Database,
  kind: CollectionKind,
): Promise<LastCollection | null> {
  const [run] = await db
    .select()
    .from(collectionRun)
    .where(eq(collectionRun.kind, kind))
    .orderBy(desc(collectionRun.id))
    .limit(1);

  if (run == null) return null;

  return {
    finishedAt: run.finishedAt,
    source: run.source,
    isOk: run.status === "ok",
    saved: run.saved,
    errorMessage: run.errorMessage,
  };
}

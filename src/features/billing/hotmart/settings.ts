import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { hotmartPlanMapping, hotmartSettings } from "@/db/schema";
import { PAID_PLAN_IDS } from "@/features/plans/plans";
import {
  buildHotmartPlanMapping,
  HOTMART_ID_KINDS,
  type HotmartIdKind,
  type HotmartPlanMapping,
  type HotmartPlanRow,
} from "./plan-mapping";

/**
 * Off until sign-up confirms the e-mail (security review, lead 1): otherwise anyone who signs up
 * with a buyer's e-mail gets the plan. Until then events are only recorded, never applied.
 */
export const HOTMART_UNLOCKS_PLANS = false;

const SETTINGS_ROW_ID = 1;

/** The code itself is never stored: only this hash, compared in constant time on each event. */
export function hashHottok(hottok: string): string {
  return createHash("sha256").update(hottok, "utf8").digest("hex");
}

export async function getHottokHash(db: Database): Promise<{
  hash: string;
  updatedAt: Date;
} | null> {
  const [row] = await db
    .select({
      hash: hotmartSettings.hottokHash,
      updatedAt: hotmartSettings.updatedAt,
    })
    .from(hotmartSettings)
    .where(eq(hotmartSettings.id, SETTINGS_ROW_ID));

  return row ?? null;
}

export async function saveHottok(
  db: Database,
  hottok: string,
  now: Date,
): Promise<void> {
  const hottokHash = hashHottok(hottok);

  await db
    .insert(hotmartSettings)
    .values({ id: SETTINGS_ROW_ID, hottokHash, updatedAt: now })
    .onConflictDoUpdate({
      target: hotmartSettings.id,
      set: { hottokHash, updatedAt: now },
    });
}

function isIdKind(value: string): value is HotmartIdKind {
  const kinds: readonly string[] = HOTMART_ID_KINDS;

  return kinds.includes(value);
}

/**
 * Rows an admin saved, oldest first. A row the code no longer understands is left out, and so is
 * one that would "unlock" no plan: that would wipe a real plan on purchase.
 */
export async function listHotmartPlanRows(
  db: Database,
): Promise<HotmartPlanRow[]> {
  const rows = await db
    .select({
      kind: hotmartPlanMapping.kind,
      hotmartId: hotmartPlanMapping.hotmartId,
      plan: hotmartPlanMapping.plan,
    })
    .from(hotmartPlanMapping)
    .orderBy(asc(hotmartPlanMapping.createdAt), hotmartPlanMapping.hotmartId);

  return rows.flatMap((row) => {
    const plan = PAID_PLAN_IDS.find((id) => id === row.plan);

    if (isIdKind(row.kind) === false || plan == null) return [];

    return [{ kind: row.kind, hotmartId: row.hotmartId, plan }];
  });
}

export async function loadHotmartPlanMapping(
  db: Database,
): Promise<HotmartPlanMapping> {
  return buildHotmartPlanMapping(await listHotmartPlanRows(db));
}

/** Saving the same Hotmart id again changes its plan. */
export async function saveHotmartPlanRow(
  db: Database,
  row: HotmartPlanRow,
): Promise<void> {
  await db
    .insert(hotmartPlanMapping)
    .values(row)
    .onConflictDoUpdate({
      target: [hotmartPlanMapping.kind, hotmartPlanMapping.hotmartId],
      set: { plan: row.plan },
    });
}

export async function removeHotmartPlanRow(
  db: Database,
  key: { kind: HotmartIdKind; hotmartId: string },
): Promise<boolean> {
  const removed = await db
    .delete(hotmartPlanMapping)
    .where(
      and(
        eq(hotmartPlanMapping.kind, key.kind),
        eq(hotmartPlanMapping.hotmartId, key.hotmartId),
      ),
    )
    .returning({ hotmartId: hotmartPlanMapping.hotmartId });

  return removed.length > 0;
}

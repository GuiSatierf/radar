import type { PlanId } from "@/features/plans/plans";

/**
 * Which Hotmart subscription plan or product unlocks which of our plans, keyed "plano:<id>" or
 * "produto:<id>". A subscription plan wins over its product.
 */
export type HotmartPlanMapping = ReadonlyMap<string, PlanId>;

export const HOTMART_ID_KINDS = ["plano", "produto"] as const;
export type HotmartIdKind = (typeof HOTMART_ID_KINDS)[number];

export interface HotmartPlanRow {
  readonly kind: HotmartIdKind;
  readonly hotmartId: string;
  readonly plan: PlanId;
}

export function buildHotmartPlanMapping(
  rows: readonly HotmartPlanRow[],
): HotmartPlanMapping {
  return new Map(rows.map((row) => [`${row.kind}:${row.hotmartId}`, row.plan]));
}

export function resolveHotmartPlan(
  mapping: HotmartPlanMapping,
  ids: { planId: string | null; productId: string },
): PlanId | null {
  const byPlan =
    ids.planId == null ? undefined : mapping.get(`plano:${ids.planId}`);

  return byPlan ?? mapping.get(`produto:${ids.productId}`) ?? null;
}

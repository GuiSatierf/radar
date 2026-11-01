import type { RunningAccess } from "@/features/billing/access";
import { DEFAULT_PLAN, type PlanId } from "@/features/plans/plans";

export type PlanOrigin =
  | { readonly kind: "none" }
  | { readonly kind: "manual" }
  | { readonly kind: "hotmart"; readonly endsAt: Date | null };

/**
 * Where the account's plan came from. The plan itself is one column, so the origin is read from
 * whether it matches a running Hotmart purchase: if not, an admin set it by hand.
 */
export function describePlanOrigin(
  accountPlan: PlanId,
  hotmart: RunningAccess | undefined,
): PlanOrigin {
  if (hotmart != null && hotmart.plan === accountPlan)
    return { kind: "hotmart", endsAt: hotmart.endsAt };

  // A buyer left without a plan was also changed by an admin, so only "no purchase, no plan"
  // has nothing to say.
  if (accountPlan === DEFAULT_PLAN && hotmart == null) return { kind: "none" };

  return { kind: "manual" };
}

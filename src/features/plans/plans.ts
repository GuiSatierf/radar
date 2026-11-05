/**
 * Access to the tools. There are no plans to choose from: an account either has access to every
 * tool (a Hotmart purchase or an admin unlocked it) or has none yet. Everything about it lives
 * here, so changing it later touches no screen.
 */
export const TOOLS = [
  "radar",
  "rankings",
  "anuncios",
  "creators",
  "studio",
] as const;
export type Tool = (typeof TOOLS)[number];

/** "none" first: a later index is more access (the billing code ranks by it). */
export const PLAN_IDS = ["none", "full"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const DEFAULT_PLAN: PlanId = "none";
/** The access a purchase or an admin unlocks. */
export const FULL_ACCESS: PlanId = "full";

export interface Plan {
  readonly id: PlanId;
  readonly tools: readonly Tool[];
  readonly monthlyVideos: number;
}

const ALL_TOOLS: readonly Tool[] = TOOLS;

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  none: {
    id: "none",
    tools: [],
    monthlyVideos: 0,
  },
  full: {
    id: "full",
    tools: ALL_TOOLS,
    monthlyVideos: 12,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return PLAN_IDS.some((id) => id === value);
}

export function planIncludesTool(planId: PlanId, tool: Tool): boolean {
  return PLANS[planId].tools.includes(tool);
}

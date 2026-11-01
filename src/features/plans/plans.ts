/**
 * Plans and what each one opens. PROVISIONAL: names, tools and video limits wait for the client's
 * decision (prices and payment too). Everything about plans lives here, so changing them later
 * touches no screen.
 */
export const TOOLS = [
  "radar",
  "rankings",
  "anuncios",
  "creators",
  "studio",
] as const;
export type Tool = (typeof TOOLS)[number];

export const PLAN_IDS = ["none", "radar", "completo", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const DEFAULT_PLAN: PlanId = "none";
/** Every plan except "no plan": what a purchase can unlock. */
export const PAID_PLAN_IDS = PLAN_IDS.filter((id) => id !== DEFAULT_PLAN);

export interface Plan {
  readonly id: PlanId;
  readonly label: string;
  /** One short sentence for the person, shown in settings and in the admin. */
  readonly description: string;
  readonly tools: readonly Tool[];
  readonly monthlyVideos: number;
}

const ALL_TOOLS: readonly Tool[] = TOOLS;

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  none: {
    id: "none",
    label: "Sem plano",
    description: "A conta foi criada, mas ainda não tem um plano liberado.",
    tools: [],
    monthlyVideos: 0,
  },
  radar: {
    id: "radar",
    label: "Radar",
    description: "Radar, Rankings e Anúncios, sem criar vídeos.",
    tools: ["radar", "rankings", "anuncios"],
    monthlyVideos: 0,
  },
  completo: {
    id: "completo",
    label: "Completo",
    description: "Todas as ferramentas, com 12 vídeos por mês.",
    tools: ALL_TOOLS,
    monthlyVideos: 12,
  },
  pro: {
    id: "pro",
    label: "Pro",
    description: "Todas as ferramentas, com 30 vídeos por mês.",
    tools: ALL_TOOLS,
    monthlyVideos: 30,
  },
};

/** From the cheapest up: the first plan that has a tool is the one the locked screen names. */
const PLANS_IN_ORDER: readonly PlanId[] = ["radar", "completo", "pro"];

export function isPlanId(value: unknown): value is PlanId {
  return PLAN_IDS.some((id) => id === value);
}

export function planIncludesTool(planId: PlanId, tool: Tool): boolean {
  return PLANS[planId].tools.includes(tool);
}

export function cheapestPlanWith(tool: Tool): Plan | null {
  const id = PLANS_IN_ORDER.find((planId) => planIncludesTool(planId, tool));

  if (id == null) return null;

  return PLANS[id];
}

import { type PlanId, planIncludesTool, TOOLS, type Tool } from "./plans";

/** The Better Auth admin plugin role that opens the admin area. */
export const ADMIN_ROLE = "admin";

export interface AccessSubject {
  readonly plan: PlanId;
  readonly isAdmin: boolean;
}

/** Admins open every tool, so they can see what a subscriber sees when helping them. */
export function canUseTool(subject: AccessSubject, tool: Tool): boolean {
  if (subject.isAdmin) return true;

  return planIncludesTool(subject.plan, tool);
}

export function listLockedTools(subject: AccessSubject): Tool[] {
  return TOOLS.filter((tool) => !canUseTool(subject, tool));
}

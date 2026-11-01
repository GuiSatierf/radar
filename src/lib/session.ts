import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ADMIN_ROLE, canUseTool } from "@/features/plans/access";
import {
  DEFAULT_PLAN,
  isPlanId,
  type PlanId,
  type Tool,
} from "@/features/plans/plans";
import {
  type CommissionProfile,
  DEFAULT_COMMISSION_PROFILE,
  isCommissionProfile,
} from "@/features/radar/domain/commission";
import { getAuth } from "@/lib/auth";

export const SIGN_IN_PATH = "/entrar";

export interface CurrentUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly commissionProfile: CommissionProfile;
  readonly plan: PlanId;
  readonly isAdmin: boolean;
}

/** The real check: every protected page and API calls this on the server (the proxy is only a shortcut). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // headers() first: it marks the page as per-request, so `next build` stops here and never
  // creates the auth instance (which needs runtime secrets the build does not have).
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });

  if (session == null) return null;

  const { id, name, email, commissionProfile, plan, role } = session.user;

  return {
    id,
    name,
    email,
    commissionProfile: isCommissionProfile(commissionProfile)
      ? commissionProfile
      : DEFAULT_COMMISSION_PROFILE,
    // An unknown plan (renamed or typed by hand in the database) opens nothing.
    plan: isPlanId(plan) ? plan : DEFAULT_PLAN,
    isAdmin: role === ADMIN_ROLE,
  };
});

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (user == null) redirect(SIGN_IN_PATH);

  return user;
}

export interface ToolAccess {
  readonly user: CurrentUser;
  readonly isAllowed: boolean;
}

/**
 * Every tool page and tool API calls this first and stops when isAllowed is false. Checked inside
 * the page itself, not a layout: Next renders layouts and pages separately.
 */
export async function checkToolAccess(tool: Tool): Promise<ToolAccess> {
  const user = await requireCurrentUser();

  return { user, isAllowed: canUseTool(user, tool) };
}

/** For admin pages: anyone else gets "page not found", so the admin area stays invisible. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireCurrentUser();

  if (!user.isAdmin) notFound();

  return user;
}

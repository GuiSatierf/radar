"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { user } from "@/db/schema";
import { ADMIN_ROLE } from "@/features/plans/access";
import { PLAN_IDS } from "@/features/plans/plans";
import { getAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "./guard";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const ADMIN_PATH = "/admin";
const NOT_ALLOWED: AdminActionResult = {
  ok: false,
  message: NOT_ALLOWED_MESSAGE,
};
const USER_NOT_FOUND: AdminActionResult = {
  ok: false,
  message: "Essa conta não existe mais. Atualize a página.",
};

const userIdSchema = z.string().trim().min(1).max(100);
const changePlanSchema = z.object({
  userId: userIdSchema,
  plan: z.enum(PLAN_IDS),
});
const setBlockedSchema = z.object({
  userId: userIdSchema,
  blocked: z.boolean(),
});

async function findTarget(
  userId: string,
): Promise<{ id: string; role: string | null } | null> {
  const [target] = await getDatabase()
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return target ?? null;
}

export async function changeUserPlan(
  input: unknown,
): Promise<AdminActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  const parsed = changePlanSchema.safeParse(input);

  if (!parsed.success)
    return { ok: false, message: "Escolha um plano da lista." };

  const updated = await getDatabase()
    .update(user)
    .set({ plan: parsed.data.plan })
    .where(eq(user.id, parsed.data.userId))
    .returning({ id: user.id });

  if (updated.length === 0) return USER_NOT_FOUND;

  logger.info(
    { userId: parsed.data.userId, plan: parsed.data.plan },
    "plan changed by admin",
  );
  revalidatePath(ADMIN_PATH);

  return { ok: true };
}

/** Blocking ends every session of that account at once (Better Auth admin plugin). */
export async function setUserBlocked(
  input: unknown,
): Promise<AdminActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  const parsed = setBlockedSchema.safeParse(input);

  if (!parsed.success) return { ok: false, message: "Pedido inválido." };

  const target = await findTarget(parsed.data.userId);

  if (target == null) return USER_NOT_FOUND;

  // Admins cannot lock each other (or themselves) out; that is done in the database, on purpose.
  if (target.role === ADMIN_ROLE) {
    return {
      ok: false,
      message: "Contas de admin não podem ser bloqueadas aqui.",
    };
  }

  const request = { body: { userId: target.id }, headers: await headers() };
  const { api } = getAuth();

  await (parsed.data.blocked ? api.banUser(request) : api.unbanUser(request));

  logger.info(
    { userId: target.id, blocked: parsed.data.blocked },
    "account block changed by admin",
  );
  revalidatePath(ADMIN_PATH);

  return { ok: true };
}

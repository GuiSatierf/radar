"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { grantAccess, revokeAccess } from "@/features/billing/access-grants";
import { PAID_PLAN_IDS } from "@/features/plans/plans";
import { logger } from "@/lib/logger";
import type { AdminActionResult } from "./actions";
import { MAX_EMAIL_LENGTH, parseEmailList } from "./email-list";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "./guard";

const ACCESS_ADMIN_PATH = "/admin/acessos";
const ACCOUNTS_ADMIN_PATH = "/admin";
const NOT_ALLOWED = { ok: false, message: NOT_ALLOWED_MESSAGE } as const;

const MAX_EMAILS_PER_GRANT = 200;
// Room for the longest e-mails at the limit above, with separators.
const MAX_PASTED_LENGTH = 60_000;

const grantSchema = z.object({
  emails: z.string().max(MAX_PASTED_LENGTH),
  plan: z.enum(PAID_PLAN_IDS),
});
const revokeSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(MAX_EMAIL_LENGTH),
});

export type GrantAccessResult =
  | { ok: true; granted: number; invalid: string[] }
  | { ok: false; message: string };

function refresh(): void {
  revalidatePath(ACCESS_ADMIN_PATH);
  revalidatePath(ACCOUNTS_ADMIN_PATH);
}

export async function grantAccessByEmail(
  input: unknown,
): Promise<GrantAccessResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = grantSchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Cole os e-mails e escolha um plano." };

  const list = parseEmailList(parsed.data.emails);

  if (list.valid.length === 0)
    return { ok: false, message: "Nenhum e-mail válido na lista." };

  // Probably a whole spreadsheet column pasted by mistake: nothing is unlocked.
  if (list.invalid.length > MAX_EMAILS_PER_GRANT)
    return {
      ok: false,
      message:
        "Muita coisa na lista não parece e-mail. Confira o que foi colado.",
    };

  if (list.valid.length > MAX_EMAILS_PER_GRANT)
    return {
      ok: false,
      message: `Cole até ${MAX_EMAILS_PER_GRANT} e-mails por vez.`,
    };

  await grantAccess(
    getDatabase(),
    { emails: list.valid, plan: parsed.data.plan },
    new Date(),
  );
  // Only how many and which plan: e-mails are personal data.
  logger.info(
    { count: list.valid.length, plan: parsed.data.plan },
    "access granted by e-mail by admin",
  );
  refresh();

  return { ok: true, granted: list.valid.length, invalid: list.invalid };
}

export async function revokeAccessByEmail(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = revokeSchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Esse e-mail não está mais na lista." };

  const removed = await revokeAccess(
    getDatabase(),
    parsed.data.email,
    new Date(),
  );

  if (removed === false)
    return {
      ok: false,
      message: "Esse e-mail não está mais na lista. Atualize a página.",
    };

  logger.info("access by e-mail revoked by admin");
  refresh();

  return { ok: true };
}

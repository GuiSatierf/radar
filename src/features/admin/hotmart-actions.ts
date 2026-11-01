"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { HOTMART_ID_KINDS } from "@/features/billing/hotmart/plan-mapping";
import {
  removeHotmartPlanRow,
  saveHotmartPlanRow,
  saveHottok,
} from "@/features/billing/hotmart/settings";
import { PAID_PLAN_IDS } from "@/features/plans/plans";
import { logger } from "@/lib/logger";
import type { AdminActionResult } from "./actions";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "./guard";

const HOTMART_ADMIN_PATH = "/admin/hotmart";
const NOT_ALLOWED: AdminActionResult = {
  ok: false,
  message: NOT_ALLOWED_MESSAGE,
};
const HOTTOK_MIN_LENGTH = 8;
const HOTTOK_MAX_LENGTH = 200;

// Hotmart's plan and product codes are plain numbers.
const HOTMART_ID_PATTERN = /^\d{1,20}$/;

const hottokSchema = z.object({
  hottok: z.string().trim().min(HOTTOK_MIN_LENGTH).max(HOTTOK_MAX_LENGTH),
});
const planKeySchema = z.object({
  kind: z.enum(HOTMART_ID_KINDS),
  hotmartId: z.string().trim().regex(HOTMART_ID_PATTERN),
});
const planRowSchema = planKeySchema.extend({
  plan: z.enum(PAID_PLAN_IDS),
});

export async function saveHotmartHottok(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = hottokSchema.safeParse(input);

  if (parsed.success === false)
    return {
      ok: false,
      message: "Cole o código inteiro que a Hotmart mostra.",
    };

  await saveHottok(getDatabase(), parsed.data.hottok, new Date());
  // Never the code itself in the log.
  logger.info("hotmart hottok changed by admin");
  revalidatePath(HOTMART_ADMIN_PATH);

  return { ok: true };
}

export async function addHotmartPlan(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = planRowSchema.safeParse(input);

  if (parsed.success === false)
    return {
      ok: false,
      message: "Use só os números do código da Hotmart e escolha um plano.",
    };

  await saveHotmartPlanRow(getDatabase(), parsed.data);
  logger.info(
    { kind: parsed.data.kind, hotmartId: parsed.data.hotmartId },
    "hotmart plan mapping saved by admin",
  );
  revalidatePath(HOTMART_ADMIN_PATH);

  return { ok: true };
}

export async function removeHotmartPlan(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = planKeySchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Essa linha não existe mais." };

  const removed = await removeHotmartPlanRow(getDatabase(), parsed.data);

  if (removed === false)
    return {
      ok: false,
      message: "Essa linha não existe mais. Atualize a página.",
    };

  logger.info(
    { kind: parsed.data.kind, hotmartId: parsed.data.hotmartId },
    "hotmart plan mapping removed by admin",
  );
  revalidatePath(HOTMART_ADMIN_PATH);

  return { ok: true };
}

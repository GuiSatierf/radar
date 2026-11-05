"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { HOTMART_ID_KINDS } from "@/features/billing/hotmart/plan-mapping";
import {
  removeHotmartPlanRow,
  saveHotmartPlanRow,
  saveHottok,
  setHotmartUnlocksPlans,
  type UnlockSwitchResult,
} from "@/features/billing/hotmart/settings";
import { FULL_ACCESS } from "@/features/plans/plans";
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
const unlockSwitchSchema = z.object({ unlocks: z.boolean() });

const MISSING_STEP_MESSAGE: Record<
  Extract<UnlockSwitchResult, { ok: false }>["missing"],
  string
> = {
  hottok: "Salve o código secreto da Hotmart antes de ligar.",
  plans: "Adicione pelo menos um produto que libere o acesso antes de ligar.",
};

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

  const parsed = planKeySchema.safeParse(input);

  if (parsed.success === false)
    return {
      ok: false,
      message: "Use só os números do código da Hotmart.",
    };

  // Every product unlocks the same access; the column stays so purchases keep what they gave.
  await saveHotmartPlanRow(getDatabase(), {
    ...parsed.data,
    plan: FULL_ACCESS,
  });
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

export async function setHotmartUnlocking(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = unlockSwitchSchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Não deu para mudar. Atualize a página." };

  const result = await setHotmartUnlocksPlans(
    getDatabase(),
    parsed.data.unlocks,
    new Date(),
  );

  if (result.ok === false)
    return { ok: false, message: MISSING_STEP_MESSAGE[result.missing] };

  logger.info(
    { unlocks: parsed.data.unlocks },
    "hotmart plan unlocking switched by admin",
  );
  revalidatePath(HOTMART_ADMIN_PATH);

  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { VIDEO_LIMIT_PERIODS } from "@/features/studio/domain/quota";
import {
  SAMPLE_VIDEO_CHOICE,
  VIDEO_PROVIDER_IDS,
} from "@/features/video-ai/providers";
import {
  chooseVideoModel,
  clearVideoModel,
  removeVideoKey,
  saveVideoKey,
  saveVideoLimit,
} from "@/features/video-ai/settings";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AdminActionResult } from "./actions";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "./guard";

const VIDEO_ADMIN_PATH = "/admin/video";
const STUDIO_PATH = "/studio";
const NOT_ALLOWED: AdminActionResult = {
  ok: false,
  message: NOT_ALLOWED_MESSAGE,
};
// Far above any sensible limit, low enough to catch a typo with extra zeros.
const MAX_VIDEOS_PER_PERIOD = 1000;
const MIN_KEY_LENGTH = 10;
const MAX_KEY_LENGTH = 500;
// API keys are one word: a space or a line break means something else was pasted with it.
const KEY_PATTERN = /^\S+$/;

const limitSchema = z.object({
  // A blank field must not become 0, which would turn the Studio off for everyone.
  count: z
    .string()
    .trim()
    .min(1)
    .pipe(z.coerce.number<string>().int().min(0).max(MAX_VIDEOS_PER_PERIOD)),
  period: z.enum(VIDEO_LIMIT_PERIODS),
});
const providerSchema = z.object({ provider: z.enum(VIDEO_PROVIDER_IDS) });
const keySchema = providerSchema.extend({
  key: z
    .string()
    .trim()
    .min(MIN_KEY_LENGTH)
    .max(MAX_KEY_LENGTH)
    .regex(KEY_PATTERN),
});
const choiceSchema = z.object({
  choice: z.string().trim().min(1).max(100),
});

function refresh(): void {
  revalidatePath(VIDEO_ADMIN_PATH);
  revalidatePath(STUDIO_PATH);
}

export async function saveVideoLimitSettings(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = limitSchema.safeParse(input);

  if (parsed.success === false)
    return {
      ok: false,
      message: `Use um número de 0 a ${MAX_VIDEOS_PER_PERIOD} e escolha dia, semana ou mês.`,
    };

  await saveVideoLimit(getDatabase(), parsed.data, new Date());
  logger.info(parsed.data, "video limit changed by admin");
  refresh();

  return { ok: true };
}

export async function saveVideoProviderKey(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const secret = getServerEnv().VIDEO_KEYS_SECRET;

  if (secret == null)
    return {
      ok: false,
      message:
        "O servidor ainda não está pronto para guardar chaves. Fale com quem cuida da hospedagem.",
    };

  const parsed = keySchema.safeParse(input);

  if (parsed.success === false)
    return {
      ok: false,
      message: "Cole a chave inteira, sem espaços, do jeito que o site mostra.",
    };

  await saveVideoKey(
    getDatabase(),
    { provider: parsed.data.provider, plainKey: parsed.data.key, secret },
    new Date(),
  );
  // Never the key itself in the log.
  logger.info(
    { provider: parsed.data.provider },
    "video AI key saved by admin",
  );
  refresh();

  return { ok: true };
}

export async function removeVideoProviderKey(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = providerSchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Esse serviço não existe mais." };

  const removed = await removeVideoKey(
    getDatabase(),
    parsed.data.provider,
    new Date(),
  );

  if (removed === false)
    return { ok: false, message: "Essa chave já tinha sido tirada." };

  logger.info(
    { provider: parsed.data.provider },
    "video AI key removed by admin",
  );
  refresh();

  return { ok: true };
}

/** SAMPLE_VIDEO_CHOICE goes back to the sample video; anything else is "provider:model". */
export async function chooseVideoAi(
  input: unknown,
): Promise<AdminActionResult> {
  if ((await isAdminRequest()) === false) return NOT_ALLOWED;

  const parsed = choiceSchema.safeParse(input);

  if (parsed.success === false)
    return { ok: false, message: "Escolha uma opção da lista." };

  const db = getDatabase();
  const now = new Date();

  if (parsed.data.choice === SAMPLE_VIDEO_CHOICE) {
    await clearVideoModel(db, now);
    logger.info("video AI set back to the sample video by admin");
    refresh();

    return { ok: true };
  }

  const [provider, model, ...extra] = parsed.data.choice.split(":");
  const known = VIDEO_PROVIDER_IDS.find((id) => id === provider);

  if (known == null || model == null || extra.length > 0)
    return { ok: false, message: "Escolha uma opção da lista." };

  const result = await chooseVideoModel(db, { provider: known, model }, now);

  if (result.ok === false)
    return {
      ok: false,
      message:
        result.reason === "missing-key"
          ? "Salve a chave desse serviço antes de escolher."
          : "Escolha uma opção da lista.",
    };

  logger.info({ provider: known, model }, "video AI chosen by admin");
  refresh();

  return { ok: true };
}

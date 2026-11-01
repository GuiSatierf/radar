"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { PLANS } from "@/features/plans/plans";
import { checkToolAccess } from "@/lib/session";
import { VIDEO_FORMATS } from "./domain/formats";
import { MAX_PRODUCT_SEARCH_LENGTH } from "./domain/library";
import { BUSY_MESSAGE, describeQuotaBlock } from "./domain/messages";
import { calculateVideoQuota, formatQuotaRenewal } from "./domain/quota";
import { listStudioProducts, type StudioProduct } from "./queries";
import { type EnqueueRefusal, enqueueVideo } from "./queue";
import { runVideoQueue } from "./run-queue";

export type CreateVideoResult = { ok: true } | { ok: false; message: string };

const MAX_PRODUCT_ID_LENGTH = 40;

const createVideoSchema = z.object({
  productId: z.string().trim().min(1).max(MAX_PRODUCT_ID_LENGTH),
  format: z.enum(VIDEO_FORMATS),
});

const NOT_IN_PLAN_MESSAGE = "O Studio não está no seu plano.";

function refusalMessage(
  reason: EnqueueRefusal,
  monthlyVideos: number,
  now: Date,
): string {
  if (reason === "product-not-found") {
    return "Esse produto saiu do Radar. Escolha outro.";
  }

  if (reason === "busy") return BUSY_MESSAGE;

  const quota = calculateVideoQuota(monthlyVideos, monthlyVideos);

  return (
    describeQuotaBlock(quota, formatQuotaRenewal(now)) ?? NOT_IN_PLAN_MESSAGE
  );
}

/** Queues a video. The server checks the plan, the monthly limit and the product; never the screen. */
export async function createVideo(input: unknown): Promise<CreateVideoResult> {
  const { user, isAllowed } = await checkToolAccess("studio");

  if (isAllowed === false) return { ok: false, message: NOT_IN_PLAN_MESSAGE };

  const parsed = createVideoSchema.safeParse(input);

  if (parsed.success === false) {
    return { ok: false, message: "Escolha um produto e um formato." };
  }

  const now = new Date();
  const monthlyVideos = PLANS[user.plan].monthlyVideos;
  const result = await enqueueVideo({
    db: getDatabase(),
    userId: user.id,
    productId: parsed.data.productId,
    format: parsed.data.format,
    monthlyVideos,
    now,
  });

  if (result.ok === false) {
    return {
      ok: false,
      message: refusalMessage(result.reason, monthlyVideos, now),
    };
  }

  // Starts right after the answer is sent, so the video does not wait for the scheduled task.
  after(runVideoQueue);
  revalidatePath("/studio");

  return { ok: true };
}

export type SearchProductsResult =
  | { ok: true; products: StudioProduct[] }
  | { ok: false; message: string };

/** The product list of the picker, searched by name. */
export async function searchStudioProducts(
  search: unknown,
): Promise<SearchProductsResult> {
  const { user, isAllowed } = await checkToolAccess("studio");

  if (isAllowed === false) return { ok: false, message: NOT_IN_PLAN_MESSAGE };

  const parsed = z.string().max(MAX_PRODUCT_SEARCH_LENGTH).safeParse(search);

  if (parsed.success === false) {
    return {
      ok: false,
      message: `Use até ${MAX_PRODUCT_SEARCH_LENGTH} letras na busca.`,
    };
  }

  const text = parsed.data.trim();
  const products = await listStudioProducts({
    db: getDatabase(),
    search: text === "" ? null : text,
    profile: user.commissionProfile,
  });

  return { ok: true, products };
}

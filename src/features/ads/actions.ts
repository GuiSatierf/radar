"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/db/client";
import { getDatabase } from "@/db/client";
import { ad } from "@/db/schema";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "@/features/admin/guard";
import { logger } from "@/lib/logger";
import { MANUAL_SOURCE, type ProductLink, todayInBrazil } from "./domain/ads";
import {
  type AdFieldErrors,
  type AdFormData,
  adFormSchema,
  toAdFieldErrors,
} from "./form-schema";
import { findProductIdByUrl, productExists } from "./queries";

export type AdActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: AdFieldErrors };

const ADMIN_ADS_PATH = "/admin/anuncios";
const NOT_ALLOWED: AdActionResult = { ok: false, message: NOT_ALLOWED_MESSAGE };
const AD_NOT_FOUND: AdActionResult = {
  ok: false,
  message: "Esse anúncio não existe mais. Atualize a página.",
};
const adIdSchema = z.int().positive();

function fieldError(
  field: keyof AdFieldErrors,
  message: string,
): AdActionResult {
  return {
    ok: false,
    message: "Confira os campos marcados.",
    fieldErrors: { [field]: message },
  };
}

/** Our catalog product for the link, or the Shopee link alone when we do not have the product. */
async function resolveProduct(
  db: Database,
  link: ProductLink | null,
): Promise<
  { productId: string | null; productUrl: string | null } | AdActionResult
> {
  if (link == null) return { productId: null, productUrl: null };

  if (link.kind === "shopee") {
    return {
      productId: await findProductIdByUrl(db, link.url),
      productUrl: link.url,
    };
  }

  if (!(await productExists(db, link.productId))) {
    return fieldError("productLink", "Esse produto não está mais no Radar.");
  }

  return { productId: link.productId, productUrl: null };
}

async function isDuplicate(
  db: Database,
  libraryAdId: string,
  editingId: number | null,
): Promise<boolean> {
  const sameAd = eq(ad.libraryAdId, libraryAdId);
  const [found] = await db
    .select({ id: ad.id })
    .from(ad)
    .where(editingId == null ? sameAd : and(sameAd, ne(ad.id, editingId)))
    .limit(1);

  return found != null;
}

async function validate(
  input: unknown,
  today: string,
): Promise<AdFormData | AdActionResult> {
  const parsed = adFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Confira os campos marcados.",
      fieldErrors: toAdFieldErrors(parsed.error),
    };
  }

  // Calendar days compare correctly as text (YYYY-MM-DD).
  if (parsed.data.startedOn > today) {
    return fieldError("startedOn", "A data de início não pode ser no futuro.");
  }

  return parsed.data;
}

function isResult(value: object): value is AdActionResult {
  return "ok" in value;
}

/** Creates an ad (editingId null) or updates one. Creating counts as checking it today. */
export async function saveAd(
  input: unknown,
  editingId: number | null,
): Promise<AdActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  if (editingId != null && !adIdSchema.safeParse(editingId).success) {
    return AD_NOT_FOUND;
  }

  const db = getDatabase();
  const today = todayInBrazil(new Date());
  const data = await validate(input, today);

  if (isResult(data)) return data;

  if (await isDuplicate(db, data.libraryLink, editingId)) {
    return fieldError("libraryLink", "Esse anúncio já está cadastrado.");
  }

  const product = await resolveProduct(db, data.productLink);

  if (isResult(product)) return product;

  const values = {
    libraryAdId: data.libraryLink,
    advertiserName: data.advertiserName,
    adText: data.adText,
    platforms: data.platforms,
    startedOn: data.startedOn,
    ...product,
  };

  if (editingId == null) {
    await db.insert(ad).values({ ...values, lastSeenOn: today });
    logger.info({ libraryAdId: values.libraryAdId }, "ad added by admin");
    revalidatePath(ADMIN_ADS_PATH);

    return { ok: true };
  }

  // From now on collections keep what the admin wrote and only update when it was seen.
  const updated = await db
    .update(ad)
    .set({ ...values, isCurated: true })
    .where(eq(ad.id, editingId))
    .returning({ id: ad.id });

  if (updated.length === 0) return AD_NOT_FOUND;

  logger.info({ adId: editingId }, "ad edited by admin");
  revalidatePath(ADMIN_ADS_PATH);

  return { ok: true };
}

/** "Conferi hoje": the admin saw the ad still running, so its days on air grow up to today. */
export async function markAdSeenToday(id: unknown): Promise<AdActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  const parsed = adIdSchema.safeParse(id);

  if (!parsed.success) return AD_NOT_FOUND;

  const updated = await getDatabase()
    .update(ad)
    // Seen running today, so it is running again even if a collection had marked it stopped.
    .set({ lastSeenOn: todayInBrazil(new Date()), isActive: true })
    .where(eq(ad.id, parsed.data))
    .returning({ id: ad.id });

  if (updated.length === 0) return AD_NOT_FOUND;

  revalidatePath(ADMIN_ADS_PATH);

  return { ok: true };
}

/**
 * Takes a manual ad off the list (it stopped running, or was a mistake). Automatic ads are hidden
 * instead: deleted, the next collection would bring them back.
 */
export async function removeAd(id: unknown): Promise<AdActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  const parsed = adIdSchema.safeParse(id);

  if (!parsed.success) return AD_NOT_FOUND;

  const removed = await getDatabase()
    .delete(ad)
    .where(and(eq(ad.id, parsed.data), eq(ad.source, MANUAL_SOURCE)))
    .returning({ id: ad.id });

  if (removed.length === 0) {
    return {
      ok: false,
      message:
        "Esse anúncio veio da coleta automática: use Esconder, senão ele volta na próxima coleta.",
    };
  }

  logger.info({ adId: parsed.data }, "ad removed by admin");
  revalidatePath(ADMIN_ADS_PATH);

  return { ok: true };
}

const setHiddenSchema = z.object({
  id: adIdSchema,
  hidden: z.boolean(),
});

/** Hides an ad from subscribers (e.g. a supermarket ad); collections never unhide it. */
export async function setAdHidden(input: unknown): Promise<AdActionResult> {
  if (!(await isAdminRequest())) return NOT_ALLOWED;

  const parsed = setHiddenSchema.safeParse(input);

  if (!parsed.success) return AD_NOT_FOUND;

  const updated = await getDatabase()
    .update(ad)
    .set({ isHidden: parsed.data.hidden })
    .where(eq(ad.id, parsed.data.id))
    .returning({ id: ad.id });

  if (updated.length === 0) return AD_NOT_FOUND;

  logger.info(
    { adId: parsed.data.id, hidden: parsed.data.hidden },
    "ad visibility changed by admin",
  );
  revalidatePath(ADMIN_ADS_PATH);

  return { ok: true };
}

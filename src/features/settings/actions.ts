"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { user } from "@/db/schema";
import { isCommissionProfile } from "@/features/radar/domain/commission";
import { requireCurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; message: string };

/** The server checks who is asking and what was sent; the screen is never trusted. */
export async function updateCommissionProfile(
  value: unknown,
): Promise<ActionResult> {
  const currentUser = await requireCurrentUser();

  if (!isCommissionProfile(value)) {
    return { ok: false, message: "Escolha 3%, 4% ou 8%." };
  }

  await getDatabase()
    .update(user)
    .set({ commissionProfile: value })
    .where(eq(user.id, currentUser.id));

  revalidatePath("/", "layout");

  return { ok: true };
}

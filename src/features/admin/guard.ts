import "server-only";
import { getCurrentUser } from "@/lib/session";

export const NOT_ALLOWED_MESSAGE =
  "Só quem administra a plataforma pode fazer isso.";

/** Server actions are public endpoints: each one checks the role again, whatever the screen shows. */
export async function isAdminRequest(): Promise<boolean> {
  const current = await getCurrentUser();

  return current?.isAdmin === true;
}

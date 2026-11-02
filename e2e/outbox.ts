import { expect } from "@playwright/test";
import { readOutbox } from "../src/sources/email/outbox-email-sender";

/** Where the e2e app writes its e-mails (EMAIL_OUTBOX_DIR), read back by the tests. */
export const E2E_OUTBOX_DIR = ".outbox-e2e";

/** The confirmation link in the newest e-mail sent to this address (it goes out in background). */
export async function confirmationLinkFor(email: string): Promise<string> {
  let link: string | null = null;

  await expect
    .poll(async () => {
      const messages = await readOutbox(E2E_OUTBOX_DIR);
      const latest = messages.filter((message) => message.to === email).at(-1);
      link =
        /https?:\/\/\S+\/verify-email\?token=\S+/.exec(
          latest?.text ?? "",
        )?.[0] ?? null;

      return link;
    })
    .not.toBeNull();

  if (link == null) throw new Error("no confirmation link");

  return link;
}

import type { EmailMessage, EmailSender } from "@/sources/email/email-sender";
import type { Auth } from "./auth";

/** Keeps every e-mail the app sends, so a test can open its link. */
export function capturingSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];

  return {
    name: "capture",
    sent,
    send: async (message) => void sent.push(message),
  };
}

/** The token in the newest confirmation link sent to this e-mail. */
export function verificationTokenFor(
  sent: readonly EmailMessage[],
  email: string,
): string {
  const message = sent.findLast((candidate) => candidate.to === email);
  const match = /\/verify-email\?token=([^&\s]+)/.exec(message?.text ?? "");

  if (match?.[1] == null)
    throw new Error(`no confirmation link sent to ${email}`);

  return match[1];
}

/** Opens the confirmation link the way the person would, by its token. */
export async function confirmEmail(
  auth: Auth,
  sent: readonly EmailMessage[],
  email: string,
): Promise<void> {
  await auth.api.verifyEmail({
    query: { token: verificationTokenFor(sent, email) },
  });
}

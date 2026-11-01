import type { EmailSender } from "./email-sender";
import { createOutboxEmailSender } from "./outbox-email-sender";
import { createResendEmailSender } from "./resend-email-sender";

/**
 * The local outbox when EMAIL_OUTBOX_DIR is set (development and tests), Resend when its key and
 * sender address are set, otherwise none: then the app says "fale com o suporte" instead of
 * promising an e-mail. The env schema (src/lib/env.ts) only lets the key in with an address.
 */
export function selectEmailSender(env: {
  EMAIL_OUTBOX_DIR?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}): EmailSender | null {
  if (env.EMAIL_OUTBOX_DIR != null)
    return createOutboxEmailSender(env.EMAIL_OUTBOX_DIR);

  if (env.RESEND_API_KEY == null || env.EMAIL_FROM == null) return null;

  return createResendEmailSender({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
  });
}

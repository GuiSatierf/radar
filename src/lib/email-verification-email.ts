import type { EmailMessage } from "@/sources/email/email-sender";
import { greetByFirstName } from "./password-reset-email";

/** How long the link works; Better Auth gets it in seconds and the e-mail says it in words. */
export const VERIFICATION_LINK_HOURS = 24;

/** The "confirme seu e-mail" e-mail, in plain text and plain words. */
export function buildEmailVerificationEmail(input: {
  appName: string;
  name: string;
  to: string;
  url: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `Confirme seu e-mail no ${input.appName}`,
    text: [
      greetByFirstName(input.name),
      "",
      `Para confirmar que este e-mail é seu no ${input.appName}, abra este link:`,
      input.url,
      "",
      "Abra o link no aparelho em que você entrou na conta.",
      "Se você comprou ou ganhou acesso, ele é liberado assim que você confirmar.",
      `O link vale por ${VERIFICATION_LINK_HOURS} horas.`,
      "Se não foi você que criou a conta, pode ignorar este e-mail.",
    ].join("\n"),
  };
}

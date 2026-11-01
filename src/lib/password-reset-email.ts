import type { EmailMessage } from "@/sources/email/email-sender";

/** Better Auth's default; the e-mail says it in words. */
export const RESET_LINK_HOURS = 1;

/** The "esqueci minha senha" e-mail, in plain text and plain words. */
export function buildPasswordResetEmail(input: {
  appName: string;
  name: string;
  to: string;
  url: string;
}): EmailMessage {
  const firstName = input.name.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName.length > 0 ? `Olá, ${firstName}!` : "Olá!";

  return {
    to: input.to,
    subject: `Crie uma senha nova no ${input.appName}`,
    text: [
      greeting,
      "",
      `Para criar uma senha nova no ${input.appName}, abra este link:`,
      input.url,
      "",
      `O link vale por ${RESET_LINK_HOURS} hora e só funciona uma vez.`,
      "Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.",
    ].join("\n"),
  };
}

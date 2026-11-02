import type { EmailMessage } from "@/sources/email/email-sender";

/** Better Auth's default; the e-mail says it in words. */
export const RESET_LINK_HOURS = 1;

/** "Olá, Maria!" from "Maria Souza", or a plain "Olá!" without a name. */
export function greetByFirstName(name: string): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";

  return firstName.length > 0 ? `Olá, ${firstName}!` : "Olá!";
}

/** The "esqueci minha senha" e-mail, in plain text and plain words. */
export function buildPasswordResetEmail(input: {
  appName: string;
  name: string;
  to: string;
  url: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `Crie uma senha nova no ${input.appName}`,
    text: [
      greetByFirstName(input.name),
      "",
      `Para criar uma senha nova no ${input.appName}, abra este link:`,
      input.url,
      "",
      `O link vale por ${RESET_LINK_HOURS} hora e só funciona uma vez.`,
      "Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.",
    ].join("\n"),
  };
}

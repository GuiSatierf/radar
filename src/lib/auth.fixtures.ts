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

/** The newest confirmation link sent to this e-mail, as the person gets it. */
function verificationLinkFor(
  sent: readonly EmailMessage[],
  email: string,
): string {
  const message = sent.findLast((candidate) => candidate.to === email);
  const link = /https?:\/\/\S+\/verify-email\?token=\S+/.exec(
    message?.text ?? "",
  )?.[0];

  if (link == null) throw new Error(`no confirmation link sent to ${email}`);

  return link;
}

/** The session cookie a browser keeps after signing in with this e-mail and password. */
export async function signInCookie(
  auth: Auth,
  email: string,
  password: string,
): Promise<string> {
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers.get("set-cookie")?.split(";")[0];

  if (cookie == null) throw new Error(`no session cookie for ${email}`);

  return cookie;
}

/** Opens the confirmation link in a browser holding this cookie, or none. */
export async function openConfirmationLink(
  auth: Auth,
  sent: readonly EmailMessage[],
  email: string,
  cookie: string | null,
): Promise<Response> {
  const headers = new Headers();

  if (cookie != null) headers.set("cookie", cookie);

  return auth.handler(
    new Request(verificationLinkFor(sent, email), { headers }),
  );
}

/** Opens the confirmation link the way its owner would: signed in to the account. */
export async function confirmEmail(
  auth: Auth,
  sent: readonly EmailMessage[],
  email: string,
  password: string,
): Promise<void> {
  const cookie = await signInCookie(auth, email, password);

  await openConfirmationLink(auth, sent, email, cookie);
}

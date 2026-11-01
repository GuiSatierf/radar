/**
 * The seam between the app and whatever sends e-mail. Today only the local outbox exists (a file
 * on the developer's machine and in the tests); a real provider plugs in here without touching
 * the auth code.
 */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

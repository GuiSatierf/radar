import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { EmailMessage, EmailSender } from "./email-sender";

const OUTBOX_FILE = "emails.jsonl";

export const OUTBOX_SENDER_NAME = "outbox";

/**
 * Never sends anything: each message becomes one JSON line in `<dir>/emails.jsonl`, where the
 * developer (or an end-to-end test) reads it. Only for development and tests.
 */
export function createOutboxEmailSender(directory: string): EmailSender {
  return {
    name: OUTBOX_SENDER_NAME,
    send: async (message) => {
      await mkdir(directory, { recursive: true });
      const line = JSON.stringify({ ...message, sentAt: new Date() });

      await appendFile(path.join(directory, OUTBOX_FILE), `${line}\n`, "utf8");
    },
  };
}

/** Every message in the outbox, oldest first; empty when nothing was sent yet. */
export async function readOutbox(directory: string): Promise<EmailMessage[]> {
  try {
    const content = await readFile(path.join(directory, OUTBOX_FILE), "utf8");

    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as EmailMessage);
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && error.code === "ENOENT";

    if (isMissing) return [];

    throw error;
  }
}

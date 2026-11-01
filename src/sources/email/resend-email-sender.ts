import { z } from "zod";
import type { EmailSender } from "./email-sender";

export const RESEND_SENDER_NAME = "resend";
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

const DEFAULT_TIMEOUT_MS = 10_000;
// Resend explains a refused e-mail in a short `name` (like "validation_error"); never the key.
const errorBodySchema = z.object({ name: z.string().max(100) });

export interface ResendOptions {
  readonly apiKey: string;
  // "Nome <endereco@dominio>", on a domain verified in the Resend account.
  readonly from: string;
  /** Injected so tests never touch the network. */
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

/** Resend refused the e-mail, or did not answer in time. No retry: the person can ask again. */
export class EmailDeliveryError extends Error {
  constructor(
    readonly status: number | null,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(`Resend did not send the e-mail: ${reason}`, options);
    this.name = "EmailDeliveryError";
  }
}

async function readErrorName(response: Response): Promise<string> {
  try {
    const parsed = errorBodySchema.safeParse(await response.json());

    return parsed.success ? parsed.data.name : `HTTP ${response.status}`;
  } catch {
    // Not JSON: the status alone says enough.
    return `HTTP ${response.status}`;
  }
}

async function postOrDeliveryError(
  fetchFn: typeof fetch,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchFn(RESEND_ENDPOINT, init);
  } catch (error) {
    throw new EmailDeliveryError(null, "network failure or timeout", {
      cause: error,
    });
  }
}

/** Real e-mail through the Resend HTTP API (https://resend.com/docs/api-reference). */
export function createResendEmailSender(options: ResendOptions): EmailSender {
  const fetchFn = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: RESEND_SENDER_NAME,
    send: async (message) => {
      const response = await postOrDeliveryError(fetchFn, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) return;

      throw new EmailDeliveryError(
        response.status,
        await readErrorName(response),
      );
    },
  };
}

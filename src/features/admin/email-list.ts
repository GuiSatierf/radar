import { z } from "zod";

// One per line, or separated by commas, semicolons or spaces, as people paste from a spreadsheet.
const SEPARATORS = /[\s,;]+/;
// The longest e-mail address the standard allows; removing one checks the same limit.
export const MAX_EMAIL_LENGTH = 320;
const emailSchema = z.email().max(MAX_EMAIL_LENGTH);

export interface EmailList {
  // Lowercase and without repeats, in the order they were pasted.
  readonly valid: string[];
  readonly invalid: string[];
}

function isEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

/** "1 e-mail liberado", "3 e-mails liberados". */
export function describeGrantedCount(count: number): string {
  if (count === 1) return "1 e-mail liberado";

  return `${count} e-mails liberados`;
}

/** Splits what the admin pasted into the e-mails to unlock and the ones that are not e-mails. */
export function parseEmailList(text: string): EmailList {
  const items = text
    .normalize("NFC")
    .split(SEPARATORS)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  const unique = [...new Set(items)];

  return {
    valid: unique.filter((item) => isEmail(item)),
    invalid: unique.filter((item) => isEmail(item) === false),
  };
}

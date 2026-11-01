import { eq } from "drizzle-orm";
import type { Database } from "../../src/db/client";
import { user } from "../../src/db/schema";
import type { Auth } from "../../src/lib/auth";

export interface DemoAccount {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** Creates the demo account once; running the seed again changes nothing. */
export async function seedDemoAccount(input: {
  auth: Auth;
  db: Database;
  account: DemoAccount;
}): Promise<"created" | "already-exists"> {
  // Better Auth stores e-mails lowercased; compare the same way or a second run would crash.
  const email = input.account.email.trim().toLowerCase();

  const existing = await input.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) return "already-exists";

  await input.auth.api.signUpEmail({ body: { ...input.account, email } });

  return "created";
}

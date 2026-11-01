import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { session, user } from "@/db/schema";
import type { EmailMessage, EmailSender } from "@/sources/email/email-sender";
import { createAuth } from "./auth";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const ENV = {
  APP_NAME: "Teste",
  BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
  BETTER_AUTH_URL: "http://localhost:3210",
  CLIENT_IP_HEADER: "x-real-ip",
};
const MARIA = {
  name: "Maria Souza",
  email: "maria@teste.test",
  password: "senha-antiga-123",
};
const NEW_PASSWORD = "senha-nova-456";

function capturingSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];

  return {
    name: "capture",
    sent,
    send: async (message) => void sent.push(message),
  };
}

let sender = capturingSender();
let auth = createAuth(db, ENV, { emailSender: sender });

/** The token at the end of the link path in the e-mail. */
function tokenFrom(message: EmailMessage | undefined): string {
  const match = /\/reset-password\/([^?\s]+)/.exec(message?.text ?? "");

  if (match?.[1] == null) throw new Error("no reset link in the e-mail");

  return match[1];
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
  // Signed up before the capture starts: the sign-up's confirmation e-mail is not under test here.
  await createAuth(db, ENV).api.signUpEmail({ body: MARIA });
  sender = capturingSender();
  auth = createAuth(db, ENV, { emailSender: sender });
});

afterAll(async () => {
  await pool.end();
});

describe("esqueci minha senha", () => {
  it("deve mandar um e-mail com o link para a conta que existe", async () => {
    await auth.api.requestPasswordReset({
      body: { email: MARIA.email, redirectTo: "/nova-senha" },
    });

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(MARIA.email);
    expect(sender.sent[0]?.text).toContain("Olá, Maria!");
    expect(sender.sent[0]?.text).toContain("callbackURL=%2Fnova-senha");
  });

  it("deve responder igual para um e-mail sem conta, sem mandar nada", async () => {
    const result = await auth.api.requestPasswordReset({
      body: { email: "ninguem@teste.test", redirectTo: "/nova-senha" },
    });

    expect(result.status).toBe(true);
    expect(sender.sent).toHaveLength(0);
  });

  it("deve trocar a senha, recusar a antiga e encerrar as sessões abertas", async () => {
    await auth.api.signInEmail({
      body: { email: MARIA.email, password: MARIA.password },
    });
    await auth.api.requestPasswordReset({
      body: { email: MARIA.email, redirectTo: "/nova-senha" },
    });

    await auth.api.resetPassword({
      body: { newPassword: NEW_PASSWORD, token: tokenFrom(sender.sent[0]) },
    });

    const sessions = await db
      .select({ id: session.id })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(eq(user.email, MARIA.email));
    expect(sessions).toHaveLength(0);
    await expect(
      auth.api.signInEmail({
        body: { email: MARIA.email, password: MARIA.password },
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    const signIn = await auth.api.signInEmail({
      body: { email: MARIA.email, password: NEW_PASSWORD },
    });
    expect(signIn.user.email).toBe(MARIA.email);
  });

  it("não deve aceitar o mesmo link duas vezes", async () => {
    await auth.api.requestPasswordReset({
      body: { email: MARIA.email, redirectTo: "/nova-senha" },
    });
    const token = tokenFrom(sender.sent[0]);
    await auth.api.resetPassword({
      body: { newPassword: NEW_PASSWORD, token },
    });

    const again = auth.api.resetPassword({
      body: { newPassword: "outra-senha-789", token },
    });

    await expect(again).rejects.toMatchObject({
      body: { code: "INVALID_TOKEN" },
    });
  });

  it("não deve quebrar o pedido quando não há como mandar e-mail", async () => {
    const withoutEmail = createAuth(db, ENV, { emailSender: null });

    const result = await withoutEmail.api.requestPasswordReset({
      body: { email: MARIA.email, redirectTo: "/nova-senha" },
    });

    expect(result.status).toBe(true);
  });
});

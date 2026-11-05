import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createDatabase } from "@/db/client";
import { accessGrant, user } from "@/db/schema";
import { grantAccess } from "@/features/billing/access-grants";
import { createAuth, SIGN_IN_TO_CONFIRM_PATH } from "./auth";
import {
  capturingSender,
  confirmEmail,
  openConfirmationLink,
  signInCookie,
  verificationTokenFor,
} from "./auth.fixtures";
import { VERIFICATION_LINK_HOURS } from "./email-verification-email";

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
  password: "senha-forte-123",
  callbackURL: "/radar?email=confirmado",
};
const MS_PER_HOUR = 60 * 60 * 1000;
const FOUND = 302;

let sender = capturingSender();
let auth = createAuth(db, ENV, { emailSender: sender });

async function planOfMaria(): Promise<string | undefined> {
  const [row] = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.email, MARIA.email));

  return row?.plan;
}

/** Asks for a new password and sets it through the link in the e-mail. */
async function resetPassword(newPassword: string): Promise<void> {
  await auth.api.requestPasswordReset({
    body: { email: MARIA.email, redirectTo: "/nova-senha" },
  });
  const message = sender.sent.findLast(
    (candidate) => candidate.to === MARIA.email,
  );
  const token = /\/reset-password\/([^?\s]+)/.exec(message?.text ?? "")?.[1];

  if (token == null) throw new Error("no reset link in the e-mail");

  await auth.api.resetPassword({ body: { newPassword, token } });
}

async function isConfirmed(): Promise<boolean | undefined> {
  const [row] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, MARIA.email));

  return row?.emailVerified;
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user", ${accessGrant} cascade`);
  sender = capturingSender();
  auth = createAuth(db, ENV, { emailSender: sender });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await pool.end();
});

describe("confirmar o e-mail", () => {
  it("deve mandar o link ao criar a conta, voltando para o Radar depois", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(MARIA.email);
    expect(sender.sent[0]?.subject).toBe("Confirme seu e-mail no Teste");
    expect(sender.sent[0]?.text).toContain(
      "callbackURL=%2Fradar%3Femail%3Dconfirmado",
    );
    expect(await isConfirmed()).toBe(false);
  });

  it("deve confirmar o e-mail quando a pessoa abre o link já dentro da conta", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    await confirmEmail(auth, sender.sent, MARIA.email, MARIA.password);

    expect(await isConfirmed()).toBe(true);
  });

  it("deve mandar para a tela de entrar, sem confirmar, quem abre o link fora da conta", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    const response = await openConfirmationLink(
      auth,
      sender.sent,
      MARIA.email,
      null,
    );

    expect(response.status).toBe(FOUND);
    expect(response.headers.get("location")).toBe(SIGN_IN_TO_CONFIRM_PATH);
    expect(await isConfirmed()).toBe(false);
  });

  it("não deve confirmar quando o link é aberto dentro de outra conta", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    const other = { ...MARIA, email: "outra@teste.test" };
    await auth.api.signUpEmail({ body: other });
    const otherCookie = await signInCookie(auth, other.email, other.password);

    const response = await openConfirmationLink(
      auth,
      sender.sent,
      MARIA.email,
      otherCookie,
    );

    expect(response.headers.get("location")).toBe(SIGN_IN_TO_CONFIRM_PATH);
    expect(await isConfirmed()).toBe(false);
  });

  it("deve confirmar o e-mail e liberar o plano quando a pessoa cria uma senha nova pelo e-mail", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    await grantAccess(db, { emails: [MARIA.email], plan: "full" }, new Date());

    await resetPassword("senha-nova-456");

    expect(await isConfirmed()).toBe(true);
    expect(await planOfMaria()).toBe("full");
  });

  it("não deve deixar quem criou a conta com o e-mail de outra pessoa ficar com o plano dela", async () => {
    // Someone else signs up first with Maria's e-mail and keeps the session and the password.
    await auth.api.signUpEmail({ body: MARIA });
    const intruderCookie = await signInCookie(
      auth,
      MARIA.email,
      MARIA.password,
    );
    await grantAccess(db, { emails: [MARIA.email], plan: "full" }, new Date());

    await openConfirmationLink(auth, sender.sent, MARIA.email, null);
    expect(await planOfMaria()).toBe("none");
    await resetPassword("senha-da-maria-456");

    expect(await planOfMaria()).toBe("full");
    const intruderSession = await auth.api.getSession({
      headers: new Headers({ cookie: intruderCookie }),
    });
    expect(intruderSession).toBeNull();
    await expect(
      auth.api.signInEmail({
        body: { email: MARIA.email, password: MARIA.password },
      }),
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });

  it("deve manter o plano que o admin deu antes de a pessoa confirmar", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    await db
      .update(user)
      .set({ plan: "full" })
      .where(eq(user.email, MARIA.email));

    await confirmEmail(auth, sender.sent, MARIA.email, MARIA.password);

    const [row] = await db
      .select({ plan: user.plan })
      .from(user)
      .where(eq(user.email, MARIA.email));
    expect(row?.plan).toBe("full");
  });

  it("deve recusar o link depois do prazo, sem confirmar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await auth.api.signUpEmail({ body: MARIA });
    const token = verificationTokenFor(sender.sent, MARIA.email);
    vi.setSystemTime(Date.now() + (VERIFICATION_LINK_HOURS + 1) * MS_PER_HOUR);

    const verify = auth.api.verifyEmail({ query: { token } });

    await expect(verify).rejects.toMatchObject({ status: "UNAUTHORIZED" });
    expect(await isConfirmed()).toBe(false);
  });
});

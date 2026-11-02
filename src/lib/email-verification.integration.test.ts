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
import { user } from "@/db/schema";
import { createAuth } from "./auth";
import {
  capturingSender,
  confirmEmail,
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

let sender = capturingSender();
let auth = createAuth(db, ENV, { emailSender: sender });

async function isConfirmed(): Promise<boolean | undefined> {
  const [row] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, MARIA.email));

  return row?.emailVerified;
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
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

  it("deve confirmar o e-mail quando a pessoa abre o link", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    await confirmEmail(auth, sender.sent, MARIA.email);

    expect(await isConfirmed()).toBe(true);
  });

  it("deve manter o plano que o admin deu antes de a pessoa confirmar", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    await db
      .update(user)
      .set({ plan: "completo" })
      .where(eq(user.email, MARIA.email));

    await confirmEmail(auth, sender.sent, MARIA.email);

    const [row] = await db
      .select({ plan: user.plan })
      .from(user)
      .where(eq(user.email, MARIA.email));
    expect(row?.plan).toBe("completo");
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

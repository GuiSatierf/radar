import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { accessGrant, hotmartAccess, user } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { capturingSender, confirmEmail } from "@/lib/auth.fixtures";
import { applyAccessChange } from "./access";
import { grantAccess, listAccessGrants, revokeAccess } from "./access-grants";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const sender = capturingSender();
const auth = createAuth(
  db,
  {
    APP_NAME: "Teste",
    BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
    BETTER_AUTH_URL: "http://localhost:3210",
    CLIENT_IP_HEADER: "x-real-ip",
  },
  { emailSender: sender },
);
const EMAIL = "aluna@teste.test";
const OTHER_EMAIL = "outra@teste.test";
const NOW = new Date("2026-10-27T12:00:00Z");

async function signUpWithoutConfirming(email = EMAIL): Promise<void> {
  await auth.api.signUpEmail({
    body: { name: "Aluna Teste", email, password: "senha-forte-123" },
  });
}

/** An account whose owner already opened the confirmation link. */
async function signUp(email = EMAIL): Promise<void> {
  await signUpWithoutConfirming(email);
  await confirmEmail(auth, sender.sent, email.toLowerCase());
}

async function planOf(email: string): Promise<string | undefined> {
  const [row] = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.email, email));

  return row?.plan;
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table "user", ${hotmartAccess}, ${accessGrant} cascade`,
  );
});

afterAll(async () => {
  await pool.end();
});

describe("acesso liberado por e-mail", () => {
  it("deve dar o plano ao confirmar o e-mail para quem foi liberado antes de criar a conta", async () => {
    await grantAccess(db, { emails: [EMAIL], plan: "completo" }, NOW);
    await signUpWithoutConfirming();
    expect(await planOf(EMAIL)).toBe("none");

    await confirmEmail(auth, sender.sent, EMAIL);

    expect(await planOf(EMAIL)).toBe("completo");
  });

  it("não deve dar o plano liberado a quem criou a conta com o e-mail e não confirmou", async () => {
    await signUpWithoutConfirming();

    await grantAccess(db, { emails: [EMAIL], plan: "completo" }, NOW);

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve tirar o plano ao remover a liberação, mesmo de quem não confirmou o e-mail", async () => {
    // Accounts from before the confirmation existed got the plan without confirming.
    await signUpWithoutConfirming();
    await grantAccess(db, { emails: [EMAIL], plan: "completo" }, NOW);
    await db
      .update(user)
      .set({ plan: "completo" })
      .where(eq(user.email, EMAIL));

    await revokeAccess(db, EMAIL, NOW);

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve mudar na hora o plano de quem já tem conta", async () => {
    await signUp();

    await grantAccess(db, { emails: [EMAIL, OTHER_EMAIL], plan: "pro" }, NOW);

    expect(await planOf(EMAIL)).toBe("pro");
  });

  it("deve trocar o plano quando o mesmo e-mail é liberado de novo", async () => {
    await signUp();
    await grantAccess(db, { emails: [EMAIL], plan: "pro" }, NOW);

    await grantAccess(db, { emails: [EMAIL], plan: "radar" }, NOW);

    expect(await planOf(EMAIL)).toBe("radar");
    expect(await db.select().from(accessGrant)).toHaveLength(1);
  });

  it("deve voltar para sem plano quando o acesso é tirado", async () => {
    await signUp();
    await grantAccess(db, { emails: [EMAIL], plan: "completo" }, NOW);

    const removed = await revokeAccess(db, EMAIL, NOW);

    expect(removed).toBe(true);
    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve manter o plano da Hotmart quando o acesso liberado é tirado", async () => {
    await signUp();
    await applyAccessChange(db, {
      kind: "grant",
      email: EMAIL,
      productId: "123",
      plan: "radar",
      renewsAccess: true,
      at: NOW,
    });
    await grantAccess(db, { emails: [EMAIL], plan: "pro" }, NOW);
    expect(await planOf(EMAIL)).toBe("pro");

    await revokeAccess(db, EMAIL, NOW);

    expect(await planOf(EMAIL)).toBe("radar");
  });

  it("deve dizer que não tirou nada quando o e-mail não estava na lista", async () => {
    expect(await revokeAccess(db, EMAIL, NOW)).toBe(false);
  });

  it("deve listar os e-mails dizendo quem já criou a conta", async () => {
    await signUp("Aluna@Teste.test");
    await grantAccess(db, { emails: [EMAIL, OTHER_EMAIL], plan: "radar" }, NOW);

    const rows = await listAccessGrants(db);

    expect(rows).toEqual([
      { email: EMAIL, plan: "radar", createdAt: NOW, hasAccount: true },
      { email: OTHER_EMAIL, plan: "radar", createdAt: NOW, hasAccount: false },
    ]);
  });
});

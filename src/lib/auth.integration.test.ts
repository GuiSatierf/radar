import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { account, user } from "@/db/schema";
import { seedDemoAccount } from "../../scripts/lib/seed-demo";
import { createAuth } from "./auth";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const auth = createAuth(db, {
  APP_NAME: "Teste",
  BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
  BETTER_AUTH_URL: "http://localhost:3210",
  CLIENT_IP_HEADER: "x-real-ip",
});

const MARIA = {
  name: "Maria Souza",
  email: "maria@teste.test",
  password: "senha-forte-123",
};

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
});

afterAll(async () => {
  await pool.end();
});

describe("cadastro e login", () => {
  it("deve criar a conta guardando a senha com argon2id, nunca em texto", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    const [stored] = await db
      .select({ password: account.password })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(eq(user.email, MARIA.email));

    expect(stored?.password).toMatch(/^\$argon2id\$/);
    expect(stored?.password).not.toContain(MARIA.password);
  });

  it("deve entrar com a senha certa", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    const result = await auth.api.signInEmail({
      body: { email: MARIA.email, password: MARIA.password },
    });

    expect(result.user.email).toBe(MARIA.email);
  });

  it("deve recusar a senha errada", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    const signIn = auth.api.signInEmail({
      body: { email: MARIA.email, password: "senha-errada-123" },
    });

    await expect(signIn).rejects.toMatchObject({
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });

  it("deve recusar um segundo cadastro com o mesmo e-mail", async () => {
    await auth.api.signUpEmail({ body: MARIA });

    const duplicate = auth.api.signUpEmail({ body: MARIA });

    await expect(duplicate).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });
  });
});

describe("validação no servidor", () => {
  it("deve recusar nome longo demais mesmo chamando a API direto, sem o formulário", async () => {
    const signUp = auth.api.signUpEmail({
      body: { ...MARIA, name: "a".repeat(81) },
    });

    await expect(signUp).rejects.toMatchObject({
      body: { code: "INVALID_SIGN_UP" },
    });
  });
});

describe("rotas desligadas", () => {
  it("não deve aceitar conferir a senha pela rota verify-password, nem com a conta logada", async () => {
    const signUp = await auth.api.signUpEmail({
      body: MARIA,
      returnHeaders: true,
    });
    const cookie = signUp.headers.get("set-cookie") ?? "";

    const response = await auth.handler(
      new Request("http://localhost:3210/api/auth/verify-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3210",
          cookie,
        },
        body: JSON.stringify({ password: MARIA.password }),
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("seedDemoAccount", () => {
  it("deve rodar de novo sem quebrar quando o e-mail tem letra maiúscula", async () => {
    const account = { ...MARIA, email: "Maria@Teste.TEST" };

    const first = await seedDemoAccount({ auth, db, account });
    const second = await seedDemoAccount({ auth, db, account });

    expect([first, second]).toEqual(["created", "already-exists"]);
  });

  it("deve criar a conta de demonstração uma vez só", async () => {
    const first = await seedDemoAccount({ auth, db, account: MARIA });
    const second = await seedDemoAccount({ auth, db, account: MARIA });

    const users = await db.select().from(user);

    expect([first, second]).toEqual(["created", "already-exists"]);
    expect(users).toHaveLength(1);
    expect(users[0]?.emailVerified).toBe(true);
  });
});

describe("trocar a senha estando logada", () => {
  const NEW_PASSWORD = "senha-nova-456";

  async function signInCookie(password: string): Promise<Headers> {
    const result = await auth.api.signInEmail({
      body: { email: MARIA.email, password },
      returnHeaders: true,
    });

    return new Headers({ cookie: result.headers.get("set-cookie") ?? "" });
  }

  it("deve recusar quando a senha atual está errada", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    const headers = await signInCookie(MARIA.password);

    const change = auth.api.changePassword({
      body: { currentPassword: "errada-123", newPassword: NEW_PASSWORD },
      headers,
    });

    await expect(change).rejects.toMatchObject({
      body: { code: "INVALID_PASSWORD" },
    });
  });

  it("deve trocar a senha e tirar a conta dos outros aparelhos", async () => {
    await auth.api.signUpEmail({ body: MARIA });
    const phone = await signInCookie(MARIA.password);
    const computer = await signInCookie(MARIA.password);

    await auth.api.changePassword({
      body: {
        currentPassword: MARIA.password,
        newPassword: NEW_PASSWORD,
        revokeOtherSessions: true,
      },
      headers: phone,
    });

    expect(await auth.api.getSession({ headers: computer })).toBeNull();
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
});

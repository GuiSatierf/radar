import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/client";
import { user } from "../../src/db/schema";
import { grantAdminRole, setPlanByEmail } from "./account-access";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");

async function insertUser(email: string): Promise<void> {
  await db.insert(user).values({ id: email, name: "Pessoa", email });
}

async function find(email: string) {
  const [row] = await db
    .select({ role: user.role, plan: user.plan })
    .from(user)
    .where(eq(user.email, email));

  return row;
}

beforeEach(async () => {
  await db.execute(sql`truncate table "user" cascade`);
});

afterAll(async () => {
  await pool.end();
});

describe("grantAdminRole", () => {
  it("deve tornar admin a conta que já existe, com o e-mail escrito de qualquer jeito", async () => {
    await insertUser("dona@loja.test");

    const result = await grantAdminRole(db, "  Dona@Loja.TEST ");

    expect(result).toBe("changed");
    expect((await find("dona@loja.test"))?.role).toBe("admin");
  });

  it("não deve criar conta quando o e-mail ainda não se cadastrou", async () => {
    const result = await grantAdminRole(db, "ninguem@loja.test");

    expect(result).toBe("account-not-found");
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("não deve fazer nada sem ADMIN_EMAIL", async () => {
    await insertUser("dona@loja.test");

    expect(await grantAdminRole(db, undefined)).toBe("skipped");
    expect(await grantAdminRole(db, "  ")).toBe("skipped");
    expect((await find("dona@loja.test"))?.role).toBeNull();
  });

  it("deve deixar as outras contas como estão", async () => {
    await insertUser("dona@loja.test");
    await insertUser("cliente@loja.test");

    await grantAdminRole(db, "dona@loja.test");

    expect((await find("cliente@loja.test"))?.role).toBeNull();
  });
});

describe("setPlanByEmail", () => {
  it("deve trocar o plano da conta, e só dela", async () => {
    await insertUser("demo@loja.test");
    await insertUser("cliente@loja.test");

    await setPlanByEmail(db, "demo@loja.test", "full");

    expect((await find("demo@loja.test"))?.plan).toBe("full");
    expect((await find("cliente@loja.test"))?.plan).toBe("none");
  });
});

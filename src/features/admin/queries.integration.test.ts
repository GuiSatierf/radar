import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { collectionRun, hotmartAccess, hotmartEvent, user } from "@/db/schema";
import { listRunningAccess } from "@/features/billing/access";
import {
  countUsers,
  getLastCollection,
  HOTMART_EVENTS_SHOWN,
  listRecentHotmartEvents,
  listUsersForAdmin,
} from "./queries";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");

async function insertUser(input: {
  id: string;
  name: string;
  email: string;
  banned?: boolean;
  role?: string;
  plan?: string;
  createdAt?: Date;
}): Promise<void> {
  await db.insert(user).values(input);
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table "user", ${collectionRun}, ${hotmartAccess}, ${hotmartEvent} cascade`,
  );
});

afterAll(async () => {
  await pool.end();
});

describe("listUsersForAdmin", () => {
  it("deve buscar pelo nome ou pelo e-mail, sem diferenciar maiúscula", async () => {
    await insertUser({ id: "1", name: "Maria Souza", email: "maria@a.test" });
    await insertUser({ id: "2", name: "Ana Lima", email: "ana.souza@b.test" });
    await insertUser({ id: "3", name: "Bia Rocha", email: "bia@c.test" });

    const result = await listUsersForAdmin({ db, search: "SOUZA" });

    expect(result.items.map((row) => row.id).toSorted()).toEqual(["1", "2"]);
    expect(result.total).toBe(2);
  });

  it("deve tratar % e _ da busca como letras", async () => {
    await insertUser({ id: "1", name: "Maria", email: "maria@a.test" });
    await insertUser({ id: "2", name: "50% off", email: "promo@a.test" });

    const result = await listUsersForAdmin({ db, search: "%" });

    expect(result.items.map((row) => row.id)).toEqual(["2"]);
  });

  it("deve listar as mais novas primeiro, com plano, admin e bloqueio", async () => {
    await insertUser({
      id: "velha",
      name: "Antiga",
      email: "antiga@a.test",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertUser({
      id: "nova",
      name: "Nova",
      email: "nova@a.test",
      plan: "full",
      role: "admin",
      banned: true,
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });

    const { items } = await listUsersForAdmin({ db, search: "" });

    expect(items.map((row) => row.id)).toEqual(["nova", "velha"]);
    expect(items[0]).toMatchObject({
      plan: "full",
      isAdmin: true,
      isBlocked: true,
    });
    expect(items[1]).toMatchObject({
      plan: "none",
      isAdmin: false,
      isBlocked: false,
    });
  });
});

describe("countUsers", () => {
  it("deve contar todas as contas e as bloqueadas", async () => {
    await insertUser({ id: "1", name: "A", email: "a@a.test" });
    await insertUser({ id: "2", name: "B", email: "b@a.test", banned: true });

    expect(await countUsers(db)).toEqual({ total: 2, blocked: 1 });
  });
});

describe("getLastCollection", () => {
  it("deve devolver null antes da primeira coleta", async () => {
    expect(await getLastCollection(db, "products")).toBeNull();
  });

  it("deve devolver a coleta mais recente, mesmo que tenha falhado", async () => {
    const at = (iso: string) => new Date(iso);
    await db.insert(collectionRun).values([
      {
        source: "fake",
        startedAt: at("2026-10-20T06:00:00Z"),
        finishedAt: at("2026-10-20T06:00:05Z"),
        status: "ok",
        saved: 40,
      },
      {
        source: "fake",
        startedAt: at("2026-10-21T06:00:00Z"),
        finishedAt: at("2026-10-21T06:00:01Z"),
        status: "error",
        errorMessage: "EmptySourceError: nada",
      },
    ]);

    expect(await getLastCollection(db, "products")).toEqual({
      finishedAt: at("2026-10-21T06:00:01Z"),
      source: "fake",
      isOk: false,
      saved: 0,
      errorMessage: "EmptySourceError: nada",
    });
  });

  it("deve separar a coleta de anúncios da de produtos", async () => {
    await db.insert(collectionRun).values({
      kind: "ads",
      source: "fake",
      startedAt: new Date("2026-10-21T07:00:00Z"),
      finishedAt: new Date("2026-10-21T07:00:01Z"),
      status: "ok",
      saved: 7,
    });

    expect(await getLastCollection(db, "products")).toBeNull();
    expect((await getLastCollection(db, "ads"))?.saved).toBe(7);
  });
});

describe("listRunningAccess", () => {
  const NOW = new Date("2026-10-23T12:00:00Z");
  const LATER = new Date("2026-11-12T12:00:00Z");
  const EARLIER = new Date("2026-10-01T12:00:00Z");

  async function insertAccess(input: {
    email: string;
    productId: string;
    plan: string;
    endsAt: Date | null;
  }): Promise<void> {
    await db.insert(hotmartAccess).values({ ...input, lastEventAt: EARLIER });
  }

  it("deve trazer a compra que está valendo de cada e-mail", async () => {
    await insertAccess({
      email: "a@t.test",
      productId: "1",
      plan: "full",
      endsAt: LATER,
    });
    await insertAccess({
      email: "b@t.test",
      productId: "1",
      plan: "full",
      endsAt: null,
    });

    const access = await listRunningAccess(db, ["a@t.test", "b@t.test"], NOW);

    expect(access.get("a@t.test")).toEqual({ plan: "full", endsAt: LATER });
    expect(access.get("b@t.test")).toEqual({ plan: "full", endsAt: null });
  });

  it("deve preferir a compra sem fim quando duas dão o acesso", async () => {
    await insertAccess({
      email: "a@t.test",
      productId: "1",
      plan: "full",
      endsAt: LATER,
    });
    await insertAccess({
      email: "a@t.test",
      productId: "2",
      plan: "full",
      endsAt: null,
    });

    const access = await listRunningAccess(db, ["a@t.test"], NOW);

    expect(access.get("a@t.test")).toEqual({ plan: "full", endsAt: null });
  });

  it("não deve trazer compra que já acabou nem e-mail fora da lista", async () => {
    await insertAccess({
      email: "a@t.test",
      productId: "1",
      plan: "full",
      endsAt: EARLIER,
    });
    await insertAccess({
      email: "c@t.test",
      productId: "1",
      plan: "full",
      endsAt: null,
    });

    const access = await listRunningAccess(db, ["a@t.test"], NOW);

    expect(access.size).toBe(0);
    expect((await listRunningAccess(db, [], NOW)).size).toBe(0);
  });
});

describe("listRecentHotmartEvents", () => {
  it("deve trazer os avisos mais novos primeiro, até o limite", async () => {
    const base = Date.parse("2026-10-23T12:00:00Z");
    const events = Array.from(
      { length: HOTMART_EVENTS_SHOWN + 1 },
      (_, index) => ({
        id: `evt-${index}`,
        event: "PURCHASE_APPROVED",
        receivedAt: new Date(base + index * 1000),
        outcome: "applied",
        detail: "grant",
      }),
    );
    await db.insert(hotmartEvent).values(events);

    const rows = await listRecentHotmartEvents(db);

    expect(rows).toHaveLength(HOTMART_EVENTS_SHOWN);
    expect(rows[0]?.id).toBe(`evt-${HOTMART_EVENTS_SHOWN}`);
    expect(rows.map((row) => row.id)).not.toContain("evt-0");
  });
});

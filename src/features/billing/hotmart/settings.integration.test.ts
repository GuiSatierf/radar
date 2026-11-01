import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { hotmartPlanMapping, hotmartSettings } from "@/db/schema";
import { resolveHotmartPlan } from "./plan-mapping";
import {
  getHottokHash,
  hashHottok,
  listHotmartPlanRows,
  loadHotmartPlanMapping,
  removeHotmartPlanRow,
  saveHotmartPlanRow,
  saveHottok,
} from "./settings";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const HOTTOK = "hottok-de-teste-123";
const SAVED_AT = new Date("2026-10-26T12:00:00Z");

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${hotmartSettings}, ${hotmartPlanMapping}`,
  );
});

afterAll(async () => {
  await pool.end();
});

describe("código secreto da Hotmart", () => {
  it("deve guardar só o resumo do código, nunca o código", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);

    const [stored] = await db.select().from(hotmartSettings);

    expect(stored?.hottokHash).toBe(hashHottok(HOTTOK));
    expect(JSON.stringify(stored)).not.toContain(HOTTOK);
    expect(await getHottokHash(db)).toEqual({
      hash: hashHottok(HOTTOK),
      updatedAt: SAVED_AT,
    });
  });

  it("deve trocar o código salvo, mantendo uma linha só", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);
    await saveHottok(db, "outro-codigo-456", new Date("2026-10-27T12:00:00Z"));

    const rows = await db.select().from(hotmartSettings);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.hottokHash).toBe(hashHottok("outro-codigo-456"));
  });

  it("deve dizer que não há código quando ninguém salvou", async () => {
    expect(await getHottokHash(db)).toBeNull();
  });
});

describe("produto da Hotmart → plano", () => {
  it("deve guardar, trocar o plano do mesmo código e montar o mapa", async () => {
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "radar",
    });
    await saveHotmartPlanRow(db, {
      kind: "produto",
      hotmartId: "999",
      plan: "completo",
    });
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "pro",
    });

    const rows = await listHotmartPlanRows(db);
    const mapping = await loadHotmartPlanMapping(db);

    expect(rows).toHaveLength(2);
    expect(
      resolveHotmartPlan(mapping, { planId: "460805", productId: "999" }),
    ).toBe("pro");
    expect(
      resolveHotmartPlan(mapping, { planId: null, productId: "999" }),
    ).toBe("completo");
  });

  it("deve tirar uma linha e avisar quando ela já não existe", async () => {
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "radar",
    });
    const key = { kind: "plano", hotmartId: "460805" } as const;

    expect(await removeHotmartPlanRow(db, key)).toBe(true);
    expect(await removeHotmartPlanRow(db, key)).toBe(false);
    expect(await listHotmartPlanRows(db)).toEqual([]);
  });

  it("deve deixar de fora uma linha que o código não entende mais", async () => {
    await db
      .insert(hotmartPlanMapping)
      .values({ kind: "plano", hotmartId: "1", plan: "diamante" });

    expect(await listHotmartPlanRows(db)).toEqual([]);
  });

  it('deve deixar de fora uma linha que liberaria "sem plano", para não apagar um plano pago', async () => {
    await db
      .insert(hotmartPlanMapping)
      .values({ kind: "produto", hotmartId: "2", plan: "none" });

    expect(await listHotmartPlanRows(db)).toEqual([]);
  });
});

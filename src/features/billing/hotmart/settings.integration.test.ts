import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { hotmartPlanMapping, hotmartSettings } from "@/db/schema";
import { resolveHotmartPlan } from "./plan-mapping";
import {
  getHotmartSettings,
  hashHottok,
  listHotmartPlanRows,
  loadHotmartPlanMapping,
  removeHotmartPlanRow,
  saveHotmartPlanRow,
  saveHottok,
  setHotmartUnlocksPlans,
} from "./settings";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const HOTTOK = "hottok-de-teste-123";
const SAVED_AT = new Date("2026-10-26T12:00:00Z");
const TURNED_ON_AT = new Date("2026-11-03T13:20:00Z");
const PLAN_ROW = {
  kind: "plano",
  hotmartId: "460805",
  plan: "full",
} as const;

async function unlocksPlansAt(): Promise<Date | null | undefined> {
  return (await getHotmartSettings(db))?.unlocksPlansAt;
}

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
    expect(await getHotmartSettings(db)).toEqual({
      hash: hashHottok(HOTTOK),
      updatedAt: SAVED_AT,
      unlocksPlansAt: null,
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
    expect(await getHotmartSettings(db)).toBeNull();
  });
});

describe("produto da Hotmart que libera o acesso", () => {
  it("deve guardar, não repetir o mesmo código e montar o mapa", async () => {
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "full",
    });
    await saveHotmartPlanRow(db, {
      kind: "produto",
      hotmartId: "999",
      plan: "full",
    });
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "full",
    });

    const rows = await listHotmartPlanRows(db);
    const mapping = await loadHotmartPlanMapping(db);

    expect(rows).toHaveLength(2);
    expect(
      resolveHotmartPlan(mapping, { planId: "460805", productId: "1" }),
    ).toBe("full");
    expect(
      resolveHotmartPlan(mapping, { planId: null, productId: "999" }),
    ).toBe("full");
    expect(
      resolveHotmartPlan(mapping, { planId: "1", productId: "1" }),
    ).toBeNull();
  });

  it("deve deixar de fora uma linha que ficou com um plano antigo", async () => {
    await db
      .insert(hotmartPlanMapping)
      .values({ kind: "produto", hotmartId: "777", plan: "pro" });

    expect(await listHotmartPlanRows(db)).toEqual([]);
  });

  it("deve tirar uma linha e avisar quando ela já não existe", async () => {
    await saveHotmartPlanRow(db, {
      kind: "plano",
      hotmartId: "460805",
      plan: "full",
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

describe("liberar os planos sozinho", () => {
  it("deve começar desligado depois de salvar o código", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);

    expect(await unlocksPlansAt()).toBeNull();
  });

  it("deve ligar com o código e um produto salvos, guardando quando ligou", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);
    await saveHotmartPlanRow(db, PLAN_ROW);

    const result = await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    expect(result).toEqual({ ok: true });
    expect(await unlocksPlansAt()).toEqual(TURNED_ON_AT);
  });

  it("deve recusar ligar sem o código salvo", async () => {
    await saveHotmartPlanRow(db, PLAN_ROW);

    const result = await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    expect(result).toEqual({ ok: false, missing: "hottok" });
    expect(await getHotmartSettings(db)).toBeNull();
  });

  it("deve recusar ligar sem nenhum produto que libere plano", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);

    const result = await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    expect(result).toEqual({ ok: false, missing: "plans" });
    expect(await unlocksPlansAt()).toBeNull();
  });

  it("deve manter a primeira data quando ligam de novo", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);
    await saveHotmartPlanRow(db, PLAN_ROW);
    await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    await setHotmartUnlocksPlans(db, true, new Date("2026-11-04T09:00:00Z"));

    expect(await unlocksPlansAt()).toEqual(TURNED_ON_AT);
  });

  it("deve desligar e continuar desligado quando trocam o código", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);
    await saveHotmartPlanRow(db, PLAN_ROW);
    await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    await setHotmartUnlocksPlans(db, false, TURNED_ON_AT);
    await saveHottok(db, "outro-codigo-456", new Date("2026-11-04T09:00:00Z"));

    expect(await unlocksPlansAt()).toBeNull();
  });

  it("deve continuar ligado quando trocam o código", async () => {
    await saveHottok(db, HOTTOK, SAVED_AT);
    await saveHotmartPlanRow(db, PLAN_ROW);
    await setHotmartUnlocksPlans(db, true, TURNED_ON_AT);

    await saveHottok(db, "outro-codigo-456", new Date("2026-11-04T09:00:00Z"));

    expect(await unlocksPlansAt()).toEqual(TURNED_ON_AT);
  });
});

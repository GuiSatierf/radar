import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { product, productSalesDay } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import { RANKING_SIZE } from "./filters";
import { listRisingProducts, listTopProducts } from "./queries";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const TODAY = "2026-10-23";
const NOW = new Date(`${TODAY}T12:00:00Z`);

beforeEach(async () => {
  await db.execute(sql`truncate table ${product}, ${productSalesDay} cascade`);
  await collectProducts({ db, source: createFakeProductSource(), now: NOW });
});

afterAll(async () => {
  await pool.end();
});

/** Sets one product's recorded sales on a past day. */
async function recordSales(
  productId: string,
  day: string,
  monthlySales: number,
): Promise<void> {
  await db
    .insert(productSalesDay)
    .values({ productId, day, monthlySales })
    .onConflictDoUpdate({
      target: [productSalesDay.productId, productSalesDay.day],
      set: { monthlySales },
    });
}

async function rising(category: string | null = null) {
  return listRisingProducts({ db, category, profile: 3, today: TODAY });
}

describe("listTopProducts", () => {
  it("deve trazer os mais vendidos em ordem, no máximo 30", async () => {
    const items = await listTopProducts({
      db,
      list: "vendas",
      category: null,
      profile: 3,
    });
    const sales = items.map((item) => item.monthlySales);

    expect(items).toHaveLength(RANKING_SIZE);
    expect(sales).toEqual(sales.toSorted((a, b) => b - a));
  });

  it("deve ordenar por ganho com a comissão da pessoa e respeitar a categoria", async () => {
    const items = await listTopProducts({
      db,
      list: "ganho",
      category: "pet",
      profile: 8,
    });
    const earnings = items.map((item) => item.earningsCents);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.categoryLabel === "Pet")).toBe(true);
    expect(earnings).toEqual(earnings.toSorted((a, b) => b - a));
  });
});

describe("histórico de vendas", () => {
  it("deve guardar as vendas do dia de cada produto na coleta", async () => {
    const rows = await db.select().from(productSalesDay);

    expect(rows).toHaveLength(40);
    expect(rows.every((row) => row.day === TODAY)).toBe(true);
  });

  it("deve apagar o histórico com mais de 35 dias", async () => {
    await recordSales("demo-001", "2026-09-01", 10);

    await collectProducts({ db, source: createFakeProductSource(), now: NOW });

    const old = await db.execute(
      sql`select 1 from ${productSalesDay} where ${productSalesDay.day} = '2026-09-01'`,
    );
    expect(old.rows).toHaveLength(0);
  });
});

describe("listRisingProducts", () => {
  it("deve ficar vazia antes de existir histórico de pelo menos 3 dias", async () => {
    await recordSales("demo-001", "2026-10-22", 0);

    expect(await rising()).toEqual([]);
  });

  it("deve ordenar pelo quanto as vendas cresceram desde 3 a 7 dias atrás", async () => {
    const [first, second] = await listTopProducts({
      db,
      list: "vendas",
      category: null,
      profile: 3,
    });
    if (first == null || second == null) throw new Error("demo catalog");
    await recordSales(first.id, "2026-10-18", first.monthlySales - 10);
    await recordSales(second.id, "2026-10-18", second.monthlySales - 50);
    await recordSales(second.id, "2026-10-14", 0);

    const items = await rising();

    expect(items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(items[0]?.growth).toEqual({ sales: 50, since: "2026-10-18" });
  });

  it("não deve pôr em alta um produto que vendeu menos", async () => {
    const [first] = await listTopProducts({
      db,
      list: "vendas",
      category: null,
      profile: 3,
    });
    if (first == null) throw new Error("demo catalog");
    await recordSales(first.id, "2026-10-19", first.monthlySales + 100);

    expect(await rising()).toEqual([]);
  });
});

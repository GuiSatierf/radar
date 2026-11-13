import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { product } from "@/db/schema";
import { collectProducts } from "../collect-products";
import { createFakeProductSource } from "../fake-product-source";
import { saveAffiliateCounts } from "./save-affiliate-counts";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const NOW = new Date("2026-11-12T09:00:00Z");

/** The demo catalog as the Shopee API would bring it: no affiliate count. */
async function shopeeLikeSource() {
  const demo = (await createFakeProductSource().fetchProducts()) as Record<
    string,
    unknown
  >[];

  return {
    name: "test",
    fetchProducts: async () =>
      demo.map((item) => ({
        ...item,
        affiliateCount: null,
        affiliateCountIsMinimum: false,
      })),
  };
}

async function readProduct(id: string) {
  const [row] = await db
    .select({
      affiliateCount: product.affiliateCount,
      affiliateCountIsMinimum: product.affiliateCountIsMinimum,
      opportunityScore: product.opportunityScore,
    })
    .from(product)
    .where(eq(product.id, id));

  return row;
}

let firstId = "";

beforeEach(async () => {
  await db.execute(sql`truncate table ${product} cascade`);
  const source = await shopeeLikeSource();
  await collectProducts({ db, source, now: NOW });
  const [first] = await db.select({ id: product.id }).from(product).limit(1);
  firstId = first?.id ?? "";
});

afterAll(async () => {
  await pool.end();
});

describe("saveAffiliateCounts", () => {
  it("deve gravar o número, recalcular a nota e ignorar produto que não está no Radar", async () => {
    const before = await readProduct(firstId);

    const result = await saveAffiliateCounts(db, [
      { productId: firstId, affiliateCount: 3, isMinimum: false },
      { productId: "shopee-999999", affiliateCount: 50, isMinimum: false },
    ]);

    const after = await readProduct(firstId);
    expect(result).toEqual({ updated: 1, unknown: 1 });
    expect(after?.affiliateCount).toBe(3);
    expect(after?.opportunityScore).toBeGreaterThan(
      before?.opportunityScore ?? 0,
    );
  });

  it("deve guardar o 10+ como mínimo", async () => {
    await saveAffiliateCounts(db, [
      { productId: firstId, affiliateCount: 10, isMinimum: true },
    ]);

    expect(await readProduct(firstId)).toMatchObject({
      affiliateCount: 10,
      affiliateCountIsMinimum: true,
    });
  });

  it("não deve deixar a coleta diária apagar o número enviado no admin", async () => {
    await saveAffiliateCounts(db, [
      { productId: firstId, affiliateCount: 3, isMinimum: false },
    ]);
    const scored = await readProduct(firstId);

    await collectProducts({
      db,
      source: await shopeeLikeSource(),
      now: new Date(NOW.getTime() + 86_400_000),
    });

    expect(await readProduct(firstId)).toEqual(scored);
  });
});

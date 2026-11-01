import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { ad, product } from "@/db/schema";
import { collectAds } from "@/sources/ads/collect-ads";
import { seedDemoAds } from "@/sources/ads/demo-ads";
import { createFakeAdSource } from "@/sources/ads/fake-ad-source";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import { parseAdFilters } from "./filters";
import {
  findProductIdByUrl,
  getLastCheckedOn,
  listAdCategories,
  listAds,
  listAdsForAdmin,
} from "./queries";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const TODAY = "2026-10-21";

async function list(params: Record<string, string> = {}) {
  return listAds({ db, filters: parseAdFilters(params), profile: 3 });
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${ad}, ${product} cascade`);
  await collectProducts({
    db,
    source: createFakeProductSource(),
    now: new Date(`${TODAY}T09:00:00Z`),
  });
  await seedDemoAds(db, TODAY);
});

afterAll(async () => {
  await pool.end();
});

describe("listAds", () => {
  it("deve trazer primeiro o anúncio há mais tempo no ar", async () => {
    const { items, total } = await list();

    expect(total).toBe(7);
    expect(items.map((item) => item.daysOnAir)).toEqual([
      214, 96, 61, 41, 33, 18, 7,
    ]);
  });

  it("deve ordenar pelos que começaram há menos tempo", async () => {
    const { items } = await list({ ordem: "recentes" });

    expect(items[0]?.advertiserName).toBe("Beleza Rápida");
  });

  it("deve filtrar pelo tempo no ar, com os limites de 30 e 90 dias", async () => {
    const days = async (tempo: string) =>
      (await list({ tempo })).items.map((item) => item.daysOnAir);

    expect(await days("ate-1-mes")).toEqual([18, 7]);
    expect(await days("1-a-3-meses")).toEqual([61, 41, 33]);
    expect(await days("mais-de-3-meses")).toEqual([214, 96]);
  });

  it("deve buscar no anunciante, no texto do anúncio e no nome do produto", async () => {
    const byAdvertiser = await list({ busca: "dicas da" });
    const byText = await list({ busca: "guarda-roupa" });
    const [first] = (await list()).items;
    const byProduct = await list({ busca: first?.product?.name ?? "" });

    expect(byAdvertiser.items.map((item) => item.advertiserName)).toEqual([
      "Dicas da Bia",
    ]);
    expect(byText.items.map((item) => item.advertiserName)).toEqual([
      "Achadinhos da Mari",
    ]);
    expect(byProduct.items.map((item) => item.id)).toContain(first?.id);
  });

  it("deve filtrar pela categoria do produto anunciado", async () => {
    const [category] = await listAdCategories(db);

    const { items } = await list({ categoria: category?.slug ?? "" });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.product != null)).toBe(true);
  });

  it("deve mostrar o anúncio de produto fora do catálogo sem produto, com o link da Shopee", async () => {
    const { items } = await list({ busca: "Achadinhos da Mari" });

    expect(items[0]?.product).toBeNull();
    expect(items[0]?.productUrl).toBe(
      "https://shopee.com.br/organizador-exemplo",
    );
    expect(items[0]?.libraryUrl).toBe(
      "https://www.facebook.com/ads/library/?id=900000000000007",
    );
  });

  it("deve calcular o ganho por venda do produto com o perfil da pessoa", async () => {
    const [first] = (await list()).items;
    const withEight = await listAds({
      db,
      filters: parseAdFilters({}),
      profile: 8,
    });

    expect(first?.product?.earningsCents).toBeGreaterThan(0);
    expect(withEight.items[0]?.product?.earningsCents).toBeGreaterThan(
      first?.product?.earningsCents ?? 0,
    );
  });

  it("deve manter o anúncio quando o produto sai do catálogo, só sem o produto", async () => {
    const [first] = (await list()).items;

    await db.execute(
      sql`delete from ${product} where id = ${first?.product?.id}`,
    );
    const after = await list({ busca: first?.advertiserName ?? "" });

    expect(after.items[0]?.product).toBeNull();
  });
});

describe("dados de exemplo e conferência", () => {
  it("não deve duplicar os anúncios de exemplo ao rodar o seed de novo", async () => {
    expect(await seedDemoAds(db, TODAY)).toBe(0);
    expect((await list()).total).toBe(7);
  });

  it("deve dizer o último dia em que alguém conferiu os anúncios", async () => {
    expect(await getLastCheckedOn(db)).toBe(TODAY);
  });

  it("deve achar o produto do catálogo pelo link da Shopee", async () => {
    const [row] = await db
      .select({ id: product.id, url: product.productUrl })
      .from(product)
      .limit(1);

    expect(await findProductIdByUrl(db, row?.url ?? "")).toBe(row?.id);
    expect(
      await findProductIdByUrl(db, "https://shopee.com.br/nada"),
    ).toBeNull();
  });
});

describe("anúncios automáticos junto com os manuais", () => {
  beforeEach(async () => {
    await collectAds({ db, source: createFakeAdSource(TODAY), today: TODAY });
  });

  it("deve mostrar os automáticos junto com os manuais, sem repetir o mesmo anúncio", async () => {
    const { items, total } = await list();

    expect(total).toBe(13);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items[0]?.advertiserName).toBe("Cozinha Prática Ofertas");
  });

  it("deve marcar o anúncio que parou e tirar ele do filtro só no ar agora", async () => {
    const all = await list({ busca: "Cheirinho" });
    const active = await list({ busca: "Cheirinho", ativos: "1" });

    expect(all.items[0]?.isActive).toBe(false);
    expect(active.total).toBe(0);
  });

  it("nunca deve mostrar para as assinantes o anúncio que o admin escondeu", async () => {
    await db
      .update(ad)
      .set({ isHidden: true })
      .where(eq(ad.libraryAdId, "800000000000006"));

    const { items } = await list({ busca: "Supermercado" });

    expect(items).toHaveLength(0);
  });

  it("deve separar manuais e automáticos no admin, mostrando também os escondidos", async () => {
    await db
      .update(ad)
      .set({ isHidden: true })
      .where(eq(ad.libraryAdId, "800000000000006"));

    const manual = await listAdsForAdmin(db, 3, "manuais");
    const automatic = await listAdsForAdmin(db, 3, "automaticos");
    const everything = await listAdsForAdmin(db, 3, "todos");

    expect(manual.every((item) => item.isManual)).toBe(true);
    expect(automatic.every((item) => !item.isManual)).toBe(true);
    expect(manual.length + automatic.length).toBe(everything.length);
    expect(everything.some((item) => item.isHidden)).toBe(true);
  });
});

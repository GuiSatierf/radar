import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { product } from "@/db/schema";
import {
  collectProducts,
  EmptySourceError,
} from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import { parseRadarFilters } from "./filters";
import {
  getCatalogFacts,
  getLastCollectedAt,
  getProductDetail,
  listCategories,
  listRadarProducts,
} from "./queries";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const NOW = new Date("2026-10-20T09:00:00Z");

async function list(
  params: Record<string, string | string[]>,
  profile: 3 | 4 | 8 = 3,
) {
  return listRadarProducts({
    db,
    filters: parseRadarFilters({ quantidade: "240", ...params }),
    profile,
  });
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${product} cascade`);
  await collectProducts({ db, source: createFakeProductSource(), now: NOW });
});

afterAll(async () => {
  await pool.end();
});

describe("coleta", () => {
  it("deve gravar todos os produtos válidos com a data da coleta", async () => {
    const all = await list({});

    expect(all.total).toBe(40);
    expect(await getLastCollectedAt(db)).toEqual(NOW);
  });

  it("deve pular item inválido sem perder os válidos", async () => {
    const valid = (await createFakeProductSource().fetchProducts()) as {
      categorySlug: string;
    }[];
    const kept = valid.slice(0, 30);
    const keptCategories = new Set(kept.map((item) => item.categorySlug));
    const leaving = valid
      .slice(30)
      .filter((item) => keptCategories.has(item.categorySlug)).length;
    const source = {
      name: "test",
      fetchProducts: async () => [...kept, { id: "QUEBRADO" }],
    };

    const result = await collectProducts({ db, source, now: NOW });

    expect(leaving).toBeGreaterThan(0);
    expect(result).toEqual({
      saved: 30,
      skipped: 1,
      removed: leaving,
      removalSkipped: false,
    });
  });

  it("não deve apagar o catálogo quando a fonte traz bem menos produtos que antes", async () => {
    const valid = await createFakeProductSource().fetchProducts();
    const source = {
      name: "test",
      fetchProducts: async () => valid.slice(0, 3),
    };

    const result = await collectProducts({ db, source, now: NOW });

    expect(result.removed).toBe(0);
    expect(result.removalSkipped).toBe(true);
    expect((await list({})).total).toBe(40);
  });

  it("deve manter os produtos de uma categoria que não veio, apagando só os que saíram das outras", async () => {
    const valid = (await createFakeProductSource().fetchProducts()) as {
      id: string;
      categorySlug: string;
    }[];
    const failedCategory = valid[0]?.categorySlug;
    const others = valid.filter(
      (snapshot) => snapshot.categorySlug !== failedCategory,
    );
    // A product whose category still comes back through another product.
    const leaving = others.find((candidate) =>
      others.some(
        (other) =>
          other.id !== candidate.id &&
          other.categorySlug === candidate.categorySlug,
      ),
    );
    const source = {
      name: "test",
      fetchProducts: async () =>
        others.filter((snapshot) => snapshot.id !== leaving?.id),
    };

    const result = await collectProducts({ db, source, now: NOW });

    const ids = (await list({})).items.map((item) => item.id);
    expect(leaving).toBeDefined();
    expect(result.removed).toBe(1);
    expect(ids).not.toContain(leaving?.id);
    expect(
      valid
        .filter((snapshot) => snapshot.categorySlug === failedCategory)
        .every((snapshot) => ids.includes(snapshot.id)),
    ).toBe(true);
  });

  it("deve apagar os produtos de uma categoria que não vem há mais de 7 dias", async () => {
    const valid = (await createFakeProductSource().fetchProducts()) as {
      id: string;
      categorySlug: string;
    }[];
    const missingCategory = valid[0]?.categorySlug;
    const source = {
      name: "test",
      fetchProducts: async () =>
        valid.filter((snapshot) => snapshot.categorySlug !== missingCategory),
    };
    const eightDaysLater = new Date(NOW.getTime() + 8 * 86_400_000);

    await collectProducts({ db, source, now: eightDaysLater });

    const ids = (await list({})).items.map((item) => item.id);
    expect(ids).not.toContain(valid[0]?.id);
  });

  it("não deve apagar nada quando a fonte volta vazia", async () => {
    const source = { name: "test", fetchProducts: async () => [] };

    await expect(
      collectProducts({ db, source, now: NOW }),
    ).rejects.toBeInstanceOf(EmptySourceError);
    expect((await list({})).total).toBe(40);
  });
});

/** Adds hand-made products next to the demo catalog. */
async function collectWith(extra: Record<string, unknown>[]): Promise<void> {
  const demo = await createFakeProductSource().fetchProducts();
  const source = {
    name: "test",
    fetchProducts: async () => [...demo, ...extra],
  };

  await collectProducts({ db, source, now: NOW });
}

function handMade(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "Produto feito à mão",
    categorySlug: "teste",
    categoryLabel: "Teste",
    shopName: "Loja Teste",
    productUrl: "https://shopee.com.br/search?keyword=teste",
    imageUrls: [],
    priceCents: 1_000,
    priceMaxCents: 1_000,
    sellerRateBasisPoints: 0,
    ratingTenths: null,
    ratingCount: null,
    monthlySales: 10,
    stock: null,
    affiliateCount: 100,
    affiliateCountIsMinimum: false,
    hasFreeSample: false,
    seasonalTags: [],
    videos: [],
    ...fields,
  };
}

describe("regressões da revisão", () => {
  it("deve incluir no filtro 'a partir de R$ 5' um ganho que a tela mostra como R$ 5,00", async () => {
    // R$ 49,96 × 10% = 499,6 centavos, que a tela arredonda para R$ 5,00.
    await collectWith([
      handMade({
        id: "meio-centavo",
        priceCents: 4_996,
        priceMaxCents: 4_996,
        sellerRateBasisPoints: 700,
      }),
    ]);

    const { items } = await list({ ganho: "5" });
    const product = items.find((item) => item.id === "meio-centavo");

    expect(product?.earningsCents).toBe(500);
  });

  it("não deve pôr '10+ afiliados' na concorrência baixa, porque podem ser muito mais", async () => {
    await collectWith([
      handMade({
        id: "dez-ou-mais",
        affiliateCount: 10,
        affiliateCountIsMinimum: true,
      }),
    ]);

    const { items } = await list({ concorrencia: "baixa" });

    expect(items.map((item) => item.id)).not.toContain("dez-ou-mais");
  });
});

describe("produtos sem contagem de afiliados", () => {
  it("não deve pôr um produto sem contagem em nenhum filtro de concorrência", async () => {
    await collectWith([handMade({ id: "sem-contagem", affiliateCount: null })]);

    for (const level of ["baixa", "media", "alta"]) {
      const { items } = await list({ concorrencia: level });

      expect(items.map((item) => item.id)).not.toContain("sem-contagem");
    }
  });

  it("deve mostrar o produto sem contagem depois dos contados, na ordem padrão", async () => {
    await collectWith([handMade({ id: "sem-contagem", affiliateCount: null })]);

    const { items } = await list({ ordem: "concorrencia" });

    expect(items.at(-1)?.id).toBe("sem-contagem");
    expect(items.at(-1)?.affiliateCount).toBeNull();
  });

  it("deve dizer o que o catálogo tem, para a tela não oferecer filtro vazio", async () => {
    const counted = await createFakeProductSource().fetchProducts();
    const source = {
      name: "test",
      fetchProducts: async () =>
        counted.map((item) => ({
          ...(item as Record<string, unknown>),
          affiliateCount: null,
          hasFreeSample: false,
        })),
    };

    expect(await getCatalogFacts(db)).toEqual({
      hasAffiliateCounts: true,
      hasFreeSamples: true,
    });

    await collectProducts({ db, source, now: NOW });

    expect(await getCatalogFacts(db)).toEqual({
      hasAffiliateCounts: false,
      hasFreeSamples: false,
    });
  });
});

describe("filtros", () => {
  it("deve trazer só concorrência baixa (até 50 afiliados)", async () => {
    const { items } = await list({ concorrencia: "baixa" });

    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every(
        (item) => item.affiliateCount != null && item.affiliateCount <= 50,
      ),
    ).toBe(true);
  });

  it("deve combinar Natal e comissão extra", async () => {
    const christmas = await list({ etiqueta: "natal" });
    const both = await list({ etiqueta: ["natal", "comissao-extra"] });
    const christmasNames = christmas.items.map((item) => item.name);

    expect(christmas.total).toBe(4);
    expect(
      christmasNames.every((name) => /Natal|Pisca|Quebra/.test(name)),
    ).toBe(true);
    expect(both.total).toBeLessThanOrEqual(christmas.total);
    expect(both.items.every((item) => item.hasExtraCommission)).toBe(true);
    expect(both.items.every((item) => christmasNames.includes(item.name))).toBe(
      true,
    );
  });

  it("deve respeitar o ganho mínimo por venda no perfil da pessoa", async () => {
    const { items } = await list({ ganho: "5" });

    expect(items.every((item) => item.earningsCents >= 500)).toBe(true);
  });

  it("deve tratar % e _ da busca como texto, não como curinga", async () => {
    const { total } = await list({ busca: "%" });

    expect(total).toBe(0);
  });

  it("deve filtrar por categoria e listar as categorias existentes", async () => {
    const categories = await listCategories(db);
    const { items } = await list({ categoria: "pet" });

    expect(categories.map((category) => category.slug)).toContain("pet");
    expect(items.every((item) => item.categoryLabel === "Pet")).toBe(true);
  });
});

describe("ordenação", () => {
  it("deve ordenar pela melhor nota por padrão", async () => {
    const { items } = await list({});
    const scores = items.map((item) => item.opportunityScore);

    expect(scores).toEqual(scores.toSorted((a, b) => b - a));
  });

  it("deve ordenar por menos concorrência quando pedido", async () => {
    const { items } = await list({ ordem: "concorrencia" });
    const counts = items.map(
      (item) => item.affiliateCount ?? Number.POSITIVE_INFINITY,
    );

    expect(counts).toEqual(counts.toSorted((a, b) => a - b));
  });

  it("deve ordenar por maior ganho e por mais vendidos", async () => {
    const byEarnings = (await list({ ordem: "ganho" })).items.map(
      (i) => i.earningsCents,
    );
    const bySales = (await list({ ordem: "vendas" })).items.map(
      (i) => i.monthlySales,
    );

    expect(byEarnings).toEqual(byEarnings.toSorted((a, b) => b - a));
    expect(bySales).toEqual(bySales.toSorted((a, b) => b - a));
  });
});

describe("ficha do produto", () => {
  it("deve trazer os vídeos em ordem e o ganho maior no perfil de 8%", async () => {
    const { items } = await list({});
    const withVideos = await Promise.all(
      items.map((item) => getProductDetail({ db, id: item.id, profile: 3 })),
    );
    const sample = withVideos.find(
      (item) => item != null && item.videos.length > 1,
    );

    if (sample == null)
      throw new Error("demo data should have a product with videos");

    const ranks = sample.videos.map((video) => video.rank);
    expect(ranks).toEqual(ranks.toSorted((a, b) => a - b));

    const at8 = await getProductDetail({ db, id: sample.id, profile: 8 });
    expect(at8?.earningsCents).toBeGreaterThan(sample.earningsCents);
  });

  it("deve devolver null para um produto que não existe", async () => {
    expect(
      await getProductDetail({ db, id: "nao-existe", profile: 3 }),
    ).toBeNull();
  });
});

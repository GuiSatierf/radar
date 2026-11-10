import { describe, expect, it, vi } from "vitest";
import { productSnapshotSchema } from "../product-source";
import { selectProductSource } from "../select-product-source";
import type { ShopeeCategory } from "./categories";
import type { ShopeeAffiliateClient } from "./client";
import { IncompleteShopeeCredentialsError } from "./credentials";
import type { ShopeeOffer } from "./response";
import {
  createShopeeProductSource,
  offerToSnapshot,
  SHOPEE_PRODUCT_SOURCE_NAME,
} from "./shopee-product-source";

const HOME: ShopeeCategory = {
  id: 100636,
  slug: "casa-e-decoracao",
  label: "Casa e decoração",
};
const BEAUTY: ShopeeCategory = { id: 100630, slug: "beleza", label: "Beleza" };

function offer(overrides: Partial<ShopeeOffer> = {}): ShopeeOffer {
  return {
    itemId: "22397737339",
    shopId: "352108512",
    name: "Kit 04 Capa De Almofada 45cm Decorativa",
    categoryIds: [100636, 100711],
    shopName: "SabrinaEnxovais",
    priceCents: 3_499,
    priceMaxCents: 3_528,
    sales: 570,
    ratingTenths: 45,
    commissionBasisPoints: 800,
    sellerRateBasisPoints: 500,
    shopeeRateBasisPoints: 300,
    imageUrl: "https://cf.shopee.com.br/file/exemplo",
    productUrl: "https://shopee.com.br/product/352108512/22397737339",
    affiliateUrl: "https://s.shopee.com.br/abc123",
    ...overrides,
  };
}

function fakeClient(offersByCategory: Record<number, ShopeeOffer[]>) {
  const fetchOffers = vi.fn<ShopeeAffiliateClient["fetchOffers"]>(
    async (request) => ({
      offers: offersByCategory[request.categoryId ?? 0] ?? [],
      skipped: 0,
    }),
  );

  return { fetchOffers };
}

describe("offerToSnapshot", () => {
  it("deve virar um produto válido do Radar, sem inventar o que a Shopee não manda", () => {
    const snapshot = offerToSnapshot(offer(), HOME);

    expect(productSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).toMatchObject({
      id: "shopee-22397737339",
      categorySlug: "casa-e-decoracao",
      priceCents: 3_499,
      sellerRateBasisPoints: 500,
      monthlySales: 570,
      affiliateCount: null,
      ratingCount: null,
      stock: null,
      hasFreeSample: false,
      videos: [],
    });
  });

  it("deve usar o link do produto, nunca o link de afiliado de quem tem a chave", () => {
    const snapshot = offerToSnapshot(offer(), HOME);

    expect(snapshot.productUrl).toBe(
      "https://shopee.com.br/product/352108512/22397737339",
    );
    expect(JSON.stringify(snapshot)).not.toContain("s.shopee.com.br");
  });

  it("deve cortar nome longo em vez de perder o produto", () => {
    const snapshot = offerToSnapshot(offer({ name: "a".repeat(260) }), HOME);

    expect(snapshot.name).toHaveLength(200);
    expect(productSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("deve marcar Natal pelo nome e ficar sem foto quando não há imagem", () => {
    const snapshot = offerToSnapshot(
      offer({ name: "Caneca Natalina Papai Noel", imageUrl: null }),
      HOME,
    );

    expect(snapshot.seasonalTags).toEqual(["natal"]);
    expect(snapshot.imageUrls).toEqual([]);
  });
});

describe("createShopeeProductSource", () => {
  it("deve buscar os mais vendidos de cada categoria e juntar sem repetir", async () => {
    const client = fakeClient({
      [HOME.id]: [offer({ itemId: "1" }), offer({ itemId: "2" })],
      [BEAUTY.id]: [offer({ itemId: "2" }), offer({ itemId: "3" })],
    });
    const source = createShopeeProductSource({
      client,
      categories: [HOME, BEAUTY],
      pagesPerCategory: 3,
    });

    const products = (await source.fetchProducts()) as { id: string }[];

    expect(source.name).toBe(SHOPEE_PRODUCT_SOURCE_NAME);
    expect(products.map((product) => product.id)).toEqual([
      "shopee-1",
      "shopee-2",
      "shopee-3",
    ]);
    expect(client.fetchOffers).toHaveBeenCalledWith({
      categoryId: HOME.id,
      sort: "mostSold",
      maxPages: 3,
    });
  });

  it("deve seguir com as outras categorias quando uma ainda falha depois das tentativas", async () => {
    const client = fakeClient({
      [HOME.id]: [offer({ itemId: "1" })],
      [BEAUTY.id]: [offer({ itemId: "2" })],
    });
    client.fetchOffers.mockRejectedValueOnce(new Error("Shopee fora do ar"));
    const source = createShopeeProductSource({
      client,
      categories: [HOME, BEAUTY],
    });

    const products = (await source.fetchProducts()) as { id: string }[];

    expect(products.map((product) => product.id)).toEqual(["shopee-2"]);
  });

  it("deve parar de buscar quando o tempo acaba, guardando o que já veio", async () => {
    const client = fakeClient({
      [HOME.id]: [offer({ itemId: "1" })],
      [BEAUTY.id]: [offer({ itemId: "2" })],
    });
    const times = [0, 0, 240_000];
    const source = createShopeeProductSource({
      client,
      categories: [HOME, BEAUTY],
      budgetInMs: 240_000,
      clockInMs: () => times.shift() ?? 240_000,
    });

    const products = (await source.fetchProducts()) as { id: string }[];

    expect(products.map((product) => product.id)).toEqual(["shopee-1"]);
    expect(client.fetchOffers).toHaveBeenCalledTimes(1);
  });

  it("deve falhar com o erro da Shopee quando todas as categorias falham", async () => {
    const client = fakeClient({});
    client.fetchOffers.mockRejectedValue(new Error("chave recusada"));
    const source = createShopeeProductSource({
      client,
      categories: [HOME, BEAUTY],
    });

    await expect(source.fetchProducts()).rejects.toThrow("chave recusada");
  });
});

describe("selectProductSource", () => {
  it("deve usar o catálogo de exemplo sem a chave e a Shopee com a chave", () => {
    expect(selectProductSource({}).name).toBe("fake");
    expect(
      selectProductSource({
        SHOPEE_AFFILIATE_APP_ID: "123456",
        SHOPEE_AFFILIATE_SECRET: "segredo",
      }).name,
    ).toBe(SHOPEE_PRODUCT_SOURCE_NAME);
  });

  it("deve recusar meia chave em vez de seguir com o catálogo de exemplo", () => {
    expect(() =>
      selectProductSource({ SHOPEE_AFFILIATE_APP_ID: "123456" }),
    ).toThrow(IncompleteShopeeCredentialsError);
  });
});

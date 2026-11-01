import { describe, expect, it, vi } from "vitest";
import { createShopeeAffiliateClient } from "./client";
import {
  ShopeeApiError,
  ShopeeInvalidResponseError,
  ShopeeRequestFailedError,
} from "./errors";
import { InvalidOfferRequestError } from "./query";

/** A node as third-party docs show it: decimals as strings, ids as numbers. */
function offerNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    itemId: 22193566084,
    productName: "Kit 3 utensílios de silicone",
    productCatIds: [100636, 100717],
    shopId: 1409825975,
    shopName: "Casa Bonita",
    priceMin: "24.30",
    priceMax: "29.90",
    sales: 320,
    ratingStar: "4.9",
    commissionRate: "0.13",
    sellerCommissionRate: "0.1",
    shopeeCommissionRate: "0.03",
    imageUrl: "https://down-br.img.susercontent.com/file/exemplo",
    productLink: "https://shopee.com.br/product/1409825975/22193566084",
    offerLink: "https://s.shopee.com.br/abc123",
    ...overrides,
  };
}

function page(nodes: unknown[], hasNextPage: boolean): Response {
  return Response.json({
    data: {
      productOfferV2: { nodes, pageInfo: { page: 1, limit: 50, hasNextPage } },
    },
  });
}

function apiError(code: number, message: string): Response {
  return Response.json({
    data: null,
    errors: [{ message, extensions: { code } }],
  });
}

function setup(responses: (Response | Error)[]) {
  const fetchMock = vi.fn<typeof fetch>();

  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }

  const sleep = vi.fn(async (_milliseconds: number) => {});
  const client = createShopeeAffiliateClient({
    credentials: { appId: "123456", secret: "segredo" },
    fetch: fetchMock,
    now: () => new Date("2026-10-21T12:00:00Z"),
    sleep,
  });

  return { client, fetchMock, sleep };
}

describe("fetchOfferPage", () => {
  it("deve mandar a consulta assinada e devolver a oferta já em centavos e pontos-base", async () => {
    const { client, fetchMock } = setup([page([offerNode()], false)]);

    const result = await client.fetchOfferPage({
      keyword: "kit",
      page: 1,
      limit: 50,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://open-api.affiliate.shopee.com.br/graphql");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toMatch(
      /^SHA256 Credential=123456, Timestamp=1792584000, Signature=[0-9a-f]{64}$/,
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result.offers[0]).toEqual({
      itemId: "22193566084",
      shopId: "1409825975",
      name: "Kit 3 utensílios de silicone",
      categoryIds: [100636, 100717],
      shopName: "Casa Bonita",
      priceCents: 2430,
      priceMaxCents: 2990,
      sales: 320,
      ratingTenths: 49,
      commissionBasisPoints: 1300,
      sellerRateBasisPoints: 1000,
      shopeeRateBasisPoints: 300,
      imageUrl: "https://down-br.img.susercontent.com/file/exemplo",
      productUrl: "https://shopee.com.br/product/1409825975/22193566084",
      affiliateUrl: "https://s.shopee.com.br/abc123",
    });
  });

  it("deve escapar aspas da busca dentro da consulta", async () => {
    const { client, fetchMock } = setup([page([], false)]);

    await client.fetchOfferPage({
      keyword: 'tapete "grande"',
      page: 1,
      limit: 50,
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.query).toContain('keyword: "tapete \\"grande\\""');
  });

  it("deve pular só a oferta com dado inválido e contar quantas pulou", async () => {
    const { client } = setup([
      page(
        [
          offerNode(),
          offerNode({ priceMin: "1,50" }),
          offerNode({ offerLink: "http://x" }),
        ],
        false,
      ),
    ]);

    const result = await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(result.offers).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it("deve aceitar nota vazia como sem nota", async () => {
    const { client } = setup([page([offerNode({ ratingStar: "" })], false)]);

    const result = await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(result.offers[0]?.ratingTenths).toBeNull();
  });
});

describe("retentativas", () => {
  it("deve esperar e tentar de novo quando a API diz que passou do limite (10030)", async () => {
    const { client, fetchMock, sleep } = setup([
      apiError(10030, "rate limit"),
      page([offerNode()], false),
    ]);

    const result = await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(result.offers).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("deve desistir depois de 3 tentativas, com espera crescente", async () => {
    const { client, sleep } = setup([
      apiError(10030, "rate limit"),
      apiError(10030, "rate limit"),
      apiError(10030, "rate limit"),
    ]);

    const request = client.fetchOfferPage({ page: 1, limit: 50 });

    await expect(request).rejects.toBeInstanceOf(ShopeeRequestFailedError);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      1_000, 2_000,
    ]);
  });

  it("deve tentar de novo depois de um tempo esgotado e de erro 503", async () => {
    const timeout = new DOMException(
      "The operation timed out.",
      "TimeoutError",
    );
    const { client, fetchMock } = setup([
      timeout,
      new Response(null, { status: 503 }),
      page([], false),
    ]);

    await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("não deve repetir erro que não melhora tentando de novo", async () => {
    const signature = setup([apiError(10020, "invalid signature")]);
    const unauthorized = setup([new Response(null, { status: 401 })]);
    const malformed = setup([Response.json({ data: { outraCoisa: true } })]);

    await expect(
      signature.client.fetchOfferPage({ page: 1, limit: 50 }),
    ).rejects.toBeInstanceOf(ShopeeApiError);
    await expect(
      unauthorized.client.fetchOfferPage({ page: 1, limit: 50 }),
    ).rejects.toBeInstanceOf(ShopeeRequestFailedError);
    await expect(
      malformed.client.fetchOfferPage({ page: 1, limit: 50 }),
    ).rejects.toBeInstanceOf(ShopeeInvalidResponseError);
    expect(signature.fetchMock).toHaveBeenCalledTimes(1);
    expect(unauthorized.fetchMock).toHaveBeenCalledTimes(1);
    expect(malformed.fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("proteções", () => {
  it("não deve repetir um erro do nosso próprio código como se fosse de rede", async () => {
    const { client, fetchMock } = setup([]);
    // fetch "succeeds" with nothing: reading the response fails with a TypeError in our code.
    fetchMock.mockResolvedValue(undefined as unknown as Response);

    await expect(
      client.fetchOfferPage({ page: 1, limit: 50 }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deve recusar categoria que não é número inteiro antes de chamar a API", async () => {
    const { client, fetchMock } = setup([]);

    await expect(
      client.fetchOfferPage({ categoryId: Number.NaN, page: 1, limit: 50 }),
    ).rejects.toBeInstanceOf(InvalidOfferRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("regressões da revisão", () => {
  it("deve perder só a foto quando o link da imagem não é https", async () => {
    const { client } = setup([
      page([offerNode({ imageUrl: "http://x/y.jpg" })], false),
    ]);

    const result = await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.imageUrl).toBeNull();
  });

  it("deve pular a oferta sem vendas informadas, em vez de dizer que vendeu zero", async () => {
    const { client } = setup([
      page(
        [
          offerNode({ sales: null }),
          offerNode({ sales: "" }),
          offerNode({ sales: "12" }),
        ],
        false,
      ),
    ]);

    const result = await client.fetchOfferPage({ page: 1, limit: 50 });

    expect(result.offers.map((offer) => offer.sales)).toEqual([12]);
    expect(result.skipped).toBe(2);
  });

  it("deve recusar número de páginas inválido em vez de devolver lista vazia", async () => {
    const { client, fetchMock } = setup([]);

    await expect(
      client.fetchOffers({ maxPages: Number.NaN }),
    ).rejects.toBeInstanceOf(InvalidOfferRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deve guardar a explicação da Shopee quando ela recusa a chamada", async () => {
    const { client } = setup([
      new Response("Invalid credential: key expired", { status: 403 }),
    ]);

    await expect(client.fetchOfferPage({ page: 1, limit: 50 })).rejects.toThrow(
      /HTTP 403: Invalid credential: key expired/,
    );
  });
});

describe("fetchOffers (paginação)", () => {
  it("deve seguir as páginas até a última", async () => {
    const { client, fetchMock } = setup([
      page([offerNode({ itemId: 1 })], true),
      page([offerNode({ itemId: 2 })], false),
    ]);

    const result = await client.fetchOffers({ keyword: "kit", maxPages: 10 });

    expect(result.offers.map((offer) => offer.itemId)).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondQuery = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ).query;
    expect(secondQuery).toContain("page: 2");
    expect(secondQuery).toContain("limit: 50");
  });

  it("deve parar no limite de páginas mesmo se houver mais", async () => {
    const { client, fetchMock } = setup([
      page([offerNode({ itemId: 1 })], true),
      page([offerNode({ itemId: 2 })], true),
    ]);

    const result = await client.fetchOffers({ maxPages: 2 });

    expect(result.offers).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

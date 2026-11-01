import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/db/client";
import { ad, product } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const isAdminRequestMock = vi.fn();

vi.mock("@/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/client")>()),
  getDatabase: () => db,
}));
vi.mock("@/features/admin/guard", () => ({
  isAdminRequest: isAdminRequestMock,
  NOT_ALLOWED_MESSAGE: "Só quem administra a plataforma pode fazer isso.",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

const { markAdSeenToday, removeAd, saveAd, setAdHidden } = await import(
  "./actions"
);

const VALID = {
  libraryLink: "https://www.facebook.com/ads/library/?id=123456789012",
  advertiserName: "Loja Teste",
  adText: "Texto",
  platforms: ["instagram"],
  startedOn: "2026-01-10",
  productLink: "",
};

async function storedAds() {
  return db.select().from(ad);
}

beforeEach(async () => {
  isAdminRequestMock.mockResolvedValue(true);
  await db.execute(sql`truncate table ${ad}, ${product} cascade`);
  await collectProducts({
    db,
    source: createFakeProductSource(),
    now: new Date("2026-10-21T09:00:00Z"),
  });
});

afterAll(async () => {
  await pool.end();
});

describe("quem não é admin", () => {
  it("não deve conseguir cadastrar, conferir nem tirar anúncio, nem chamando a ação direto", async () => {
    await saveAd(VALID, null);
    const [created] = await storedAds();
    isAdminRequestMock.mockResolvedValue(false);

    const results = await Promise.all([
      saveAd({ ...VALID, libraryLink: `${VALID.libraryLink}9` }, null),
      markAdSeenToday(created?.id),
      removeAd(created?.id),
    ]);

    expect(results.every((result) => !result.ok)).toBe(true);
    expect(await storedAds()).toHaveLength(1);
  });
});

describe("saveAd", () => {
  it("deve guardar só o número do anúncio e ligar ao produto do Radar", async () => {
    const [first] = await db.select({ id: product.id }).from(product).limit(1);

    const result = await saveAd(
      { ...VALID, productLink: `https://app.test/radar/${first?.id}` },
      null,
    );

    expect(result).toEqual({ ok: true });
    expect(await storedAds()).toEqual([
      expect.objectContaining({
        libraryAdId: "123456789012",
        productId: first?.id,
        productUrl: null,
        platforms: ["instagram"],
      }),
    ]);
  });

  it("deve guardar o link da Shopee sem rastreio quando o produto não está no catálogo", async () => {
    await saveAd(
      { ...VALID, productLink: "https://shopee.com.br/Item-i.1.2?sp_atk=x" },
      null,
    );

    const [stored] = await storedAds();

    expect(stored?.productId).toBeNull();
    expect(stored?.productUrl).toBe("https://shopee.com.br/Item-i.1.2");
  });

  it("deve recusar link que não é da biblioteca, data no futuro e produto que sumiu do Radar", async () => {
    const wrongLink = await saveAd(
      { ...VALID, libraryLink: "https://outro.test/?id=123456" },
      null,
    );
    const future = await saveAd({ ...VALID, startedOn: "2999-01-01" }, null);
    const missingProduct = await saveAd(
      { ...VALID, productLink: "/radar/nao-existe" },
      null,
    );

    expect(wrongLink).toMatchObject({
      ok: false,
      fieldErrors: { libraryLink: expect.any(String) },
    });
    expect(future).toMatchObject({
      ok: false,
      fieldErrors: { startedOn: expect.any(String) },
    });
    expect(missingProduct).toMatchObject({
      ok: false,
      fieldErrors: { productLink: expect.any(String) },
    });
    expect(await storedAds()).toHaveLength(0);
  });

  it("não deve cadastrar o mesmo anúncio duas vezes, mas deve deixar editar", async () => {
    await saveAd(VALID, null);
    const [created] = await storedAds();

    const duplicate = await saveAd(VALID, null);
    const edit = await saveAd(
      { ...VALID, advertiserName: "Novo nome" },
      created?.id ?? 0,
    );

    expect(duplicate).toMatchObject({
      ok: false,
      fieldErrors: { libraryLink: "Esse anúncio já está cadastrado." },
    });
    expect(edit).toEqual({ ok: true });
    expect((await storedAds()).map((row) => row.advertiserName)).toEqual([
      "Novo nome",
    ]);
  });
});

describe("conferir e tirar", () => {
  it("deve atualizar a última conferência para hoje e tirar o anúncio da lista", async () => {
    await saveAd(VALID, null);
    const [created] = await storedAds();
    await db
      .update(ad)
      .set({ lastSeenOn: "2026-02-01" })
      .where(eq(ad.id, created?.id ?? 0));

    await markAdSeenToday(created?.id);
    const [checked] = await storedAds();
    const removed = await removeAd(created?.id);

    expect(checked?.lastSeenOn).not.toBe("2026-02-01");
    expect(removed).toEqual({ ok: true });
    expect(await storedAds()).toHaveLength(0);
  });

  it("deve voltar a marcar como no ar o anúncio que a coleta tinha dado como parado", async () => {
    await saveAd(VALID, null);
    const [created] = await storedAds();
    await db
      .update(ad)
      .set({ isActive: false })
      .where(eq(ad.id, created?.id ?? 0));

    await markAdSeenToday(created?.id);
    const [checked] = await storedAds();

    expect(checked?.isActive).toBe(true);
  });

  it("deve recusar número de anúncio inválido sem mexer no banco", async () => {
    const result = await removeAd("1; drop table ad");

    expect(result.ok).toBe(false);
  });
});

describe("anúncios automáticos", () => {
  async function insertAutomatic() {
    await db.insert(ad).values({
      libraryAdId: "800000000099999",
      advertiserName: "Fonte",
      startedOn: "2026-09-01",
      lastSeenOn: "2026-10-20",
      source: "fake",
      isCurated: false,
    });
    const [row] = await db
      .select()
      .from(ad)
      .where(eq(ad.libraryAdId, "800000000099999"));

    return row;
  }

  it("deve esconder e mostrar de novo, só para admin", async () => {
    const automatic = await insertAutomatic();
    isAdminRequestMock.mockResolvedValue(false);
    const refused = await setAdHidden({ id: automatic?.id, hidden: true });
    isAdminRequestMock.mockResolvedValue(true);

    await setAdHidden({ id: automatic?.id, hidden: true });
    const [hidden] = await storedAds();

    expect(refused.ok).toBe(false);
    expect(hidden?.isHidden).toBe(true);
  });

  it("não deve apagar anúncio automático, que voltaria na próxima coleta", async () => {
    const automatic = await insertAutomatic();

    const result = await removeAd(automatic?.id);

    expect(result).toMatchObject({ ok: false, message: /Esconder/ });
    expect(await storedAds()).toHaveLength(1);
  });

  it("deve passar a proteger o que o admin escreveu num anúncio automático", async () => {
    const automatic = await insertAutomatic();

    await saveAd(
      {
        ...VALID,
        libraryLink: "https://www.facebook.com/ads/library/?id=800000000099999",
        advertiserName: "Nome corrigido",
      },
      automatic?.id ?? 0,
    );
    const [edited] = await storedAds();

    expect(edited).toMatchObject({
      advertiserName: "Nome corrigido",
      isCurated: true,
      source: "fake",
    });
  });
});

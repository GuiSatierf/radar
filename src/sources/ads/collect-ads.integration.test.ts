import { desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { ad, collectionRun, product } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import type { AdSource } from "./ad-source";
import {
  collectAds,
  collectAdsAndRecord,
  EmptyAdSourceError,
  ReservedAdSourceNameError,
} from "./collect-ads";
import { seedDemoAds } from "./demo-ads";
import { createFakeAdSource } from "./fake-ad-source";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const TODAY = "2026-10-21";
const TOMORROW = "2026-10-22";

function sourceOf(items: unknown[], name = "fornecedor"): AdSource {
  return { name, fetchAds: async () => items };
}

function snapshot(id: string, overrides: Record<string, unknown> = {}) {
  return {
    libraryAdId: id,
    advertiserName: `Anunciante ${id}`,
    adText: "Texto da fonte",
    platforms: ["instagram"],
    startedOn: "2026-09-01",
    ...overrides,
  };
}

async function findAd(libraryAdId: string) {
  const [row] = await db
    .select()
    .from(ad)
    .where(eq(ad.libraryAdId, libraryAdId));

  return row;
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${ad}, ${product}, ${collectionRun} cascade`,
  );
  await collectProducts({
    db,
    source: createFakeProductSource(),
    now: new Date(`${TODAY}T09:00:00Z`),
  });
});

afterAll(async () => {
  await pool.end();
});

describe("collectAds", () => {
  it("deve trazer os anúncios automáticos, ligados ao produto do catálogo pelo link", async () => {
    const result = await collectAds({
      db,
      source: createFakeAdSource(TODAY),
      today: TODAY,
    });

    const mixer = await findAd("800000000000001");

    expect(result).toEqual({
      saved: 7,
      skipped: 0,
      stopped: 0,
      stopSkipped: false,
    });
    expect(mixer).toMatchObject({
      source: "fake",
      isActive: true,
      isCurated: false,
      lastSeenOn: TODAY,
    });
    expect(mixer?.productId).not.toBeNull();
  });

  it("deve marcar como parado o anúncio que a fonte diz que parou, com o último dia no ar", async () => {
    await collectAds({ db, source: createFakeAdSource(TODAY), today: TODAY });

    const diffuser = await findAd("800000000000004");

    expect(diffuser).toMatchObject({
      isActive: false,
      lastSeenOn: "2026-10-12",
    });
  });

  it("deve jogar fora só o nome de plataforma desconhecido, não o anúncio", async () => {
    await collectAds({ db, source: createFakeAdSource(TODAY), today: TODAY });

    expect((await findAd("800000000000003"))?.platforms).toEqual(["facebook"]);
  });

  it("deve atualizar sem duplicar quando roda de novo no dia seguinte", async () => {
    await collectAds({ db, source: createFakeAdSource(TODAY), today: TODAY });

    await collectAds({
      db,
      source: createFakeAdSource(TOMORROW),
      today: TOMORROW,
    });

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(ad);
    expect(total).toBe(7);
    expect((await findAd("800000000000001"))?.lastSeenOn).toBe(TOMORROW);
  });

  it("nunca deve sobrescrever o que o admin escreveu, só a data em que foi visto", async () => {
    await seedDemoAds(db, "2026-10-01");
    const before = await findAd("900000000000002");

    await collectAds({ db, source: createFakeAdSource(TODAY), today: TODAY });
    const after = await findAd("900000000000002");

    expect(after).toMatchObject({
      advertiserName: before?.advertiserName,
      adText: before?.adText,
      productId: before?.productId,
      source: "manual",
      isCurated: true,
      lastSeenOn: TODAY,
    });
  });

  it("deve marcar como parado o anúncio que a fonte não traz mais, sem apagar", async () => {
    await collectAds({
      db,
      source: sourceOf([snapshot("11111"), snapshot("22222")]),
      today: TODAY,
    });

    const result = await collectAds({
      db,
      source: sourceOf([snapshot("11111")]),
      today: TOMORROW,
    });

    expect(result.stopped).toBe(1);
    expect(await findAd("22222")).toMatchObject({
      isActive: false,
      lastSeenOn: TODAY,
    });
  });

  it("não deve parar nada quando a resposta parece incompleta", async () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      snapshot(String(30000 + index)),
    );
    await collectAds({ db, source: sourceOf(many), today: TODAY });

    const result = await collectAds({
      db,
      source: sourceOf(many.slice(0, 3)),
      today: TOMORROW,
    });

    expect(result).toMatchObject({ stopped: 0, stopSkipped: true });
  });

  it("deve manter escondido o anúncio que o admin escondeu", async () => {
    await collectAds({
      db,
      source: sourceOf([snapshot("44444")]),
      today: TODAY,
    });
    await db
      .update(ad)
      .set({ isHidden: true })
      .where(eq(ad.libraryAdId, "44444"));

    await collectAds({
      db,
      source: sourceOf([snapshot("44444")]),
      today: TOMORROW,
    });

    expect((await findAd("44444"))?.isHidden).toBe(true);
  });

  it("não deve parar anúncio de outra fonte nem os manuais", async () => {
    await seedDemoAds(db, TODAY);
    await collectAds({
      db,
      source: sourceOf([snapshot("55555")], "outra"),
      today: TODAY,
    });

    await collectAds({
      db,
      source: sourceOf([snapshot("66666")]),
      today: TODAY,
    });

    expect((await findAd("55555"))?.isActive).toBe(true);
    expect((await findAd("900000000000001"))?.isActive).toBe(true);
  });

  it("deve recusar uma fonte com o nome reservado aos anúncios manuais", async () => {
    const run = collectAds({
      db,
      source: sourceOf([snapshot("77777")], "manual"),
      today: TODAY,
    });

    await expect(run).rejects.toBeInstanceOf(ReservedAdSourceNameError);
  });

  it("não deve mudar nada quando a fonte não traz nenhum anúncio válido", async () => {
    const run = collectAds({
      db,
      source: sourceOf([{ libraryAdId: "abc" }]),
      today: TODAY,
    });

    await expect(run).rejects.toBeInstanceOf(EmptyAdSourceError);
  });
});

describe("collectAdsAndRecord", () => {
  it("deve registrar a coleta de anúncios separada da de produtos", async () => {
    await collectAdsAndRecord({ db, source: createFakeAdSource(TODAY) });

    const [run] = await db
      .select()
      .from(collectionRun)
      .orderBy(desc(collectionRun.id))
      .limit(1);

    expect(run).toMatchObject({
      kind: "ads",
      source: "fake",
      status: "ok",
      saved: 7,
    });
  });
});

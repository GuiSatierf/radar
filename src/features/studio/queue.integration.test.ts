import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { product, studioVideo, user } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import {
  createFakeVideoGenerator,
  SAMPLE_VIDEO_URL,
} from "@/sources/video/fake-video-generator";
import type { VideoGenerator } from "@/sources/video/video-generator";
import { getStudioLibrary } from "./queries";
import {
  countVideosThisMonth,
  enqueueVideo,
  expireOldVideos,
  processVideoQueue,
} from "./queue";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");

const NOW = new Date("2026-10-30T15:00:00Z");
const USER_ID = "user-studio";
const instantGenerator = createFakeVideoGenerator({ generationTimeInMs: 0 });
let productId = "";

function enqueue(overrides: { monthlyVideos?: number; now?: Date } = {}) {
  return enqueueVideo({
    db,
    userId: USER_ID,
    productId,
    format: "hands",
    monthlyVideos: overrides.monthlyVideos ?? 12,
    now: overrides.now ?? NOW,
  });
}

async function storedVideos() {
  return db.select().from(studioVideo).where(eq(studioVideo.userId, USER_ID));
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table "user", ${product}, ${studioVideo} cascade`,
  );
  await db.insert(user).values({
    id: USER_ID,
    name: "Maria",
    email: "maria-studio@integration.test",
  });
  await collectProducts({ db, source: createFakeProductSource(), now: NOW });
  const [first] = await db.select({ id: product.id }).from(product).limit(1);
  productId = first?.id ?? "";
});

afterAll(async () => {
  await pool.end();
});

describe("enqueueVideo", () => {
  it("deve pôr o vídeo na fila com o nome do produto guardado", async () => {
    const result = await enqueue();

    expect(result.ok).toBe(true);
    const [video] = await storedVideos();
    expect(video).toMatchObject({ status: "queued", format: "hands" });
    expect(video?.productName.length).toBeGreaterThan(0);
  });

  it("deve recusar produto que não está no Radar", async () => {
    productId = "nao-existe";

    const result = await enqueue();

    expect(result).toEqual({ ok: false, reason: "product-not-found" });
    expect(await storedVideos()).toHaveLength(0);
  });

  it("deve aceitar um vídeo por vez por pessoa", async () => {
    await enqueue();

    const second = await enqueue();

    expect(second).toEqual({ ok: false, reason: "busy" });
    expect(await storedVideos()).toHaveLength(1);
  });

  it("deve deixar só um passar quando dois cliques chegam juntos", async () => {
    const results = await Promise.all([enqueue(), enqueue(), enqueue()]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await storedVideos()).toHaveLength(1);
  });

  it("deve recusar quando os vídeos do mês acabaram", async () => {
    await enqueue({ monthlyVideos: 1 });
    await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const result = await enqueue({ monthlyVideos: 1 });

    expect(result).toEqual({ ok: false, reason: "no-videos-left" });
  });

  it("deve liberar de novo no mês seguinte de Brasília", async () => {
    await enqueue({ monthlyVideos: 1 });
    await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const result = await enqueue({
      monthlyVideos: 1,
      now: new Date("2026-11-01T03:00:00Z"),
    });

    expect(result.ok).toBe(true);
  });
});

describe("processVideoQueue", () => {
  it("deve deixar o vídeo pronto, com link e prazo de 15 dias", async () => {
    await enqueue();

    const summary = await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });

    expect(summary).toEqual({ ready: 1, failed: 0, stuck: 0 });
    const [video] = await storedVideos();
    expect(video?.status).toBe("ready");
    expect(video?.videoUrl).toBe(SAMPLE_VIDEO_URL);
    expect(video?.expiresAt?.toISOString()).toBe("2026-11-14T15:00:00.000Z");
  });

  it("não deve gastar da conta quando o vídeo falha", async () => {
    const brokenGenerator: VideoGenerator = {
      name: "broken",
      generate: async () => {
        throw new Error("service unavailable");
      },
    };
    await enqueue();

    const summary = await processVideoQueue({
      db,
      generator: brokenGenerator,
      clock: () => NOW,
    });

    expect(summary.failed).toBe(1);
    const [video] = await storedVideos();
    expect(video?.status).toBe("failed");
    expect(video?.errorMessage).toBe("Error: service unavailable");
    expect(await countVideosThisMonth(db, USER_ID, NOW)).toBe(0);
    expect((await enqueue()).ok).toBe(true);
  });

  it("dois trabalhadores juntos não devem fazer o mesmo vídeo duas vezes", async () => {
    let calls = 0;
    const countingGenerator: VideoGenerator = {
      name: "counting",
      generate: async () => {
        calls += 1;

        return { videoUrl: SAMPLE_VIDEO_URL };
      },
    };
    await enqueue();

    await Promise.all([
      processVideoQueue({ db, generator: countingGenerator }),
      processVideoQueue({ db, generator: countingGenerator }),
    ]);

    expect(calls).toBe(1);
  });

  it("deve desistir de vídeo travado há mais de 15 minutos, sem gastar da conta", async () => {
    await enqueue();
    await db
      .update(studioVideo)
      .set({
        status: "generating",
        startedAt: new Date("2026-10-30T14:40:00Z"),
      })
      .where(eq(studioVideo.userId, USER_ID));

    const summary = await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });

    expect(summary.stuck).toBe(1);
    expect((await storedVideos())[0]?.status).toBe("failed");
    expect((await enqueue()).ok).toBe(true);
  });
});

describe("expireOldVideos e a biblioteca", () => {
  it("deve tirar da biblioteca depois de 15 dias, mas continuar contando no mês", async () => {
    await enqueue();
    await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });
    const later = new Date("2026-11-14T15:00:01Z");

    const expired = await expireOldVideos(db, later);

    expect(expired).toBe(1);
    const [video] = await storedVideos();
    expect(video).toMatchObject({ status: "expired", videoUrl: null });
    const library = await getStudioLibrary({ db, userId: USER_ID, now: later });
    expect(library.videos).toHaveLength(0);
    expect(await countVideosThisMonth(db, USER_ID, NOW)).toBe(1);
  });

  it("não deve passar a gastar da conta quando o vídeo que falhou sai da biblioteca", async () => {
    const brokenGenerator: VideoGenerator = {
      name: "broken",
      generate: async () => {
        throw new Error("service unavailable");
      },
    };
    await enqueue();
    await processVideoQueue({
      db,
      generator: brokenGenerator,
      clock: () => NOW,
    });
    const nextDay = new Date("2026-10-31T15:00:01Z");

    await expireOldVideos(db, nextDay);

    expect(await countVideosThisMonth(db, USER_ID, nextDay)).toBe(0);
    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      now: nextDay,
    });
    expect(library.videos).toHaveLength(0);
  });

  it("deve esconder o vídeo vencido mesmo antes da tarefa agendada passar", async () => {
    await enqueue();
    await processVideoQueue({
      db,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      now: new Date("2026-11-14T15:00:01Z"),
    });

    expect(library.videos).toHaveLength(0);
  });

  it("deve mostrar o vídeo sendo feito e avisar que tem um em andamento", async () => {
    await enqueue();

    const library = await getStudioLibrary({ db, userId: USER_ID, now: NOW });

    expect(library.hasActiveVideo).toBe(true);
    expect(library.videos[0]?.status).toBe("queued");
    expect(library.usedThisMonth).toBe(1);
  });
});

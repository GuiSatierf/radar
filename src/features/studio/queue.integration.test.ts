import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { product, studioVideo, user } from "@/db/schema";
import { collectProducts } from "@/sources/products/collect-products";
import { createFakeProductSource } from "@/sources/products/fake-product-source";
import {
  createFakeVideoGenerator,
  SAMPLE_VIDEO_URL,
} from "@/sources/video/fake-video-generator";
import type { VideoGenerator } from "@/sources/video/video-generator";
import type { VideoLimit } from "./domain/quota";
import { getStudioLibrary } from "./queries";
import {
  countVideosInPeriod,
  enqueueVideo,
  expireOldVideos,
  processVideoQueue,
} from "./queue";
import { readVideoFileSize, videoDownloadUrl } from "./video-files";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");

const NOW = new Date("2026-10-30T15:00:00Z");
const USER_ID = "user-studio";
const instantGenerator = createFakeVideoGenerator({ generationTimeInMs: 0 });
const ONE_PER_MONTH: VideoLimit = { count: 1, period: "month" };
let productId = "";
let videoFilesDir = "";

function enqueue(overrides: { limit?: VideoLimit; now?: Date } = {}) {
  return enqueueVideo({
    db,
    userId: USER_ID,
    productId,
    format: "hands",
    limit: overrides.limit ?? { count: 12, period: "month" },
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

beforeAll(async () => {
  videoFilesDir = await mkdtemp(path.join(os.tmpdir(), "studio-queue-"));
});

afterAll(async () => {
  await pool.end();
  await rm(videoFilesDir, { recursive: true, force: true });
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
    await enqueue({ limit: ONE_PER_MONTH });
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const result = await enqueue({ limit: ONE_PER_MONTH });

    expect(result).toEqual({ ok: false, reason: "no-videos-left" });
  });

  it("deve liberar de novo no mês seguinte de Brasília", async () => {
    await enqueue({ limit: ONE_PER_MONTH });
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const result = await enqueue({
      limit: ONE_PER_MONTH,
      now: new Date("2026-11-01T03:00:00Z"),
    });

    expect(result.ok).toBe(true);
  });

  it("com limite por dia, deve recusar no mesmo dia e liberar no dia seguinte de Brasília", async () => {
    const onePerDay: VideoLimit = { count: 1, period: "day" };
    await enqueue({ limit: onePerDay });
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const sameDay = await enqueue({
      limit: onePerDay,
      now: new Date("2026-10-31T02:00:00Z"),
    });
    const nextDay = await enqueue({
      limit: onePerDay,
      now: new Date("2026-10-31T03:00:00Z"),
    });

    expect(sameDay).toEqual({ ok: false, reason: "no-videos-left" });
    expect(nextDay.ok).toBe(true);
  });
});

describe("processVideoQueue", () => {
  it("deve deixar o vídeo pronto, com link e prazo de 15 dias", async () => {
    await enqueue();

    const summary = await processVideoQueue({
      db,
      videoFilesDir,
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
      videoFilesDir,
      generator: brokenGenerator,
      clock: () => NOW,
    });

    expect(summary.failed).toBe(1);
    const [video] = await storedVideos();
    expect(video?.status).toBe("failed");
    expect(video?.errorMessage).toBe("Error: service unavailable");
    expect(await countVideosInPeriod(db, USER_ID, "month", NOW)).toBe(0);
    expect((await enqueue()).ok).toBe(true);
  });

  it("dois trabalhadores juntos não devem fazer o mesmo vídeo duas vezes", async () => {
    let calls = 0;
    const countingGenerator: VideoGenerator = {
      name: "counting",
      generate: async () => {
        calls += 1;

        return { kind: "link", videoUrl: SAMPLE_VIDEO_URL };
      },
    };
    await enqueue();

    await Promise.all([
      processVideoQueue({ db, generator: countingGenerator, videoFilesDir }),
      processVideoQueue({ db, generator: countingGenerator, videoFilesDir }),
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
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });

    expect(summary.stuck).toBe(1);
    expect((await storedVideos())[0]?.status).toBe("failed");
    expect((await enqueue()).ok).toBe(true);
  });
});

describe("vídeo feito por uma IA de verdade", () => {
  const VIDEO_BYTES = new Uint8Array([0, 0, 0, 32, 102, 116, 121, 112]);
  const fileGenerator: VideoGenerator = {
    name: "file",
    generate: async () => ({ kind: "file", bytes: VIDEO_BYTES }),
  };

  it("deve guardar o arquivo e ligar o vídeo ao endereço de download", async () => {
    const queued = await enqueue();
    const videoId = queued.ok ? queued.videoId : "";

    const summary = await processVideoQueue({
      db,
      videoFilesDir,
      generator: fileGenerator,
      clock: () => NOW,
    });

    expect(summary.ready).toBe(1);
    const [video] = await storedVideos();
    expect(video?.videoUrl).toBe(videoDownloadUrl(videoId));
    expect(await readVideoFileSize(videoFilesDir, videoId)).toBe(
      VIDEO_BYTES.byteLength,
    );
  });

  it("deve apagar o arquivo quando o vídeo sai da biblioteca depois de 15 dias", async () => {
    const queued = await enqueue();
    const videoId = queued.ok ? queued.videoId : "";
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: fileGenerator,
      clock: () => NOW,
    });

    await expireOldVideos(db, new Date("2026-11-14T15:00:01Z"), videoFilesDir);

    expect(await readVideoFileSize(videoFilesDir, videoId)).toBeNull();
  });
});

describe("expireOldVideos e a biblioteca", () => {
  it("deve tirar da biblioteca depois de 15 dias, mas continuar contando no mês", async () => {
    await enqueue();
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });
    const later = new Date("2026-11-14T15:00:01Z");

    const expired = await expireOldVideos(db, later, videoFilesDir);

    expect(expired).toBe(1);
    const [video] = await storedVideos();
    expect(video).toMatchObject({ status: "expired", videoUrl: null });
    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      period: "month",
      now: later,
    });
    expect(library.videos).toHaveLength(0);
    expect(await countVideosInPeriod(db, USER_ID, "month", NOW)).toBe(1);
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
      videoFilesDir,
      generator: brokenGenerator,
      clock: () => NOW,
    });
    const nextDay = new Date("2026-10-31T15:00:01Z");

    await expireOldVideos(db, nextDay, videoFilesDir);

    expect(await countVideosInPeriod(db, USER_ID, "month", nextDay)).toBe(0);
    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      period: "month",
      now: nextDay,
    });
    expect(library.videos).toHaveLength(0);
  });

  it("deve esconder o vídeo vencido mesmo antes da tarefa agendada passar", async () => {
    await enqueue();
    await processVideoQueue({
      db,
      videoFilesDir,
      generator: instantGenerator,
      clock: () => NOW,
    });

    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      period: "month",
      now: new Date("2026-11-14T15:00:01Z"),
    });

    expect(library.videos).toHaveLength(0);
  });

  it("deve mostrar o vídeo sendo feito e avisar que tem um em andamento", async () => {
    await enqueue();

    const library = await getStudioLibrary({
      db,
      userId: USER_ID,
      period: "month",
      now: NOW,
    });

    expect(library.hasActiveVideo).toBe(true);
    expect(library.videos[0]?.status).toBe("queued");
    expect(library.usedInPeriod).toBe(1);
  });
});

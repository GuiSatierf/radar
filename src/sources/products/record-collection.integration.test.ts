import { desc, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { collectionRun, product } from "@/db/schema";
import { EmptySourceError } from "./collect-products";
import { createFakeProductSource } from "./fake-product-source";
import { collectAndRecord } from "./record-collection";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const START = new Date("2026-10-21T06:00:00Z");
const END = new Date("2026-10-21T06:00:04Z");

function clockFrom(...dates: Date[]): () => Date {
  const queue = [...dates];

  return () => queue.shift() ?? END;
}

async function lastRun() {
  const [run] = await db
    .select()
    .from(collectionRun)
    .orderBy(desc(collectionRun.id))
    .limit(1);

  return run;
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${product}, ${collectionRun} cascade`);
});

afterAll(async () => {
  await pool.end();
});

describe("collectAndRecord", () => {
  it("deve registrar a coleta que deu certo, com quando começou, terminou e quantos salvou", async () => {
    const result = await collectAndRecord({
      db,
      source: createFakeProductSource(),
      clock: clockFrom(START, END),
    });

    expect(await lastRun()).toMatchObject({
      source: "fake",
      status: "ok",
      startedAt: START,
      finishedAt: END,
      saved: result.saved,
      errorMessage: null,
    });
  });

  it("deve registrar a falha e continuar avisando quem chamou", async () => {
    const emptySource = {
      name: "vazia",
      fetchProducts: async () => [],
    };

    const run = collectAndRecord({
      db,
      source: emptySource,
      clock: clockFrom(START, END),
    });

    await expect(run).rejects.toBeInstanceOf(EmptySourceError);
    expect(await lastRun()).toMatchObject({
      source: "vazia",
      status: "error",
      saved: 0,
      errorMessage: expect.stringMatching(/^EmptySourceError: /),
    });
  });
});

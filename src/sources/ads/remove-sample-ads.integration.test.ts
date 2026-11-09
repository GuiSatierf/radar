import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { ad, collectionRun } from "@/db/schema";
import { MANUAL_SOURCE } from "@/features/ads/domain/ads";
import { FAKE_AD_SOURCE_NAME } from "./fake-ad-source";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const MIGRATION_FILE = new URL(
  "../../../drizzle/0014_remove_sample_ads.sql",
  import.meta.url,
);

async function runMigration(): Promise<void> {
  const text = await readFile(MIGRATION_FILE, "utf8");
  const statements = text
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

function adRow(libraryAdId: string, source: string) {
  return {
    libraryAdId,
    advertiserName: `Anunciante ${libraryAdId}`,
    adText: "",
    platforms: ["instagram"],
    startedOn: "2026-09-01",
    lastSeenOn: "2026-11-01",
    source,
  };
}

function runRow(kind: string, source: string) {
  const at = new Date("2026-11-01T09:00:00Z");

  return { kind, source, startedAt: at, finishedAt: at, status: "ok" };
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${ad}, ${collectionRun} cascade`);
});

afterAll(async () => {
  await pool.end();
});

describe("migração que tira os anúncios de exemplo", () => {
  it("deve apagar só os anúncios de exemplo e manter os do admin e de outras fontes", async () => {
    await db
      .insert(ad)
      .values([
        adRow("10000001", FAKE_AD_SOURCE_NAME),
        adRow("10000002", MANUAL_SOURCE),
        adRow("10000003", "fornecedor"),
      ]);

    await runMigration();
    const left = await db.select({ source: ad.source }).from(ad);

    expect(left.map((row) => row.source).toSorted()).toEqual([
      "fornecedor",
      MANUAL_SOURCE,
    ]);
  });

  it("deve apagar só o histórico das coletas de anúncios de exemplo", async () => {
    await db
      .insert(collectionRun)
      .values([
        runRow("ads", FAKE_AD_SOURCE_NAME),
        runRow("products", FAKE_AD_SOURCE_NAME),
        runRow("ads", "fornecedor"),
      ]);

    await runMigration();
    const fakeAdRuns = await db
      .select({ id: collectionRun.id })
      .from(collectionRun)
      .where(eq(collectionRun.source, FAKE_AD_SOURCE_NAME));
    const total = await db.select({ id: collectionRun.id }).from(collectionRun);

    expect(fakeAdRuns).toHaveLength(1);
    expect(total).toHaveLength(2);
  });
});

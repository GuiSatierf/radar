import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { videoProviderKey, videoSettings } from "@/db/schema";
import { decryptVideoKey } from "./key-box";
import {
  chooseVideoModel,
  clearVideoModel,
  getVideoSettings,
  listSavedVideoKeys,
  removeVideoKey,
  saveVideoKey,
  saveVideoLimit,
} from "./settings";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const NOW = new Date("2026-11-04T15:00:00Z");
const SECRET = "segredo-de-teste-das-chaves-com-mais-de-32";
const GOOGLE_MODEL = {
  provider: "google",
  model: "gemini-omni-1.2-flash",
} as const;

async function saveGoogleKey(): Promise<void> {
  await saveVideoKey(
    db,
    { provider: "google", plainKey: "AIzaChaveDeTeste123", secret: SECRET },
    NOW,
  );
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${videoSettings}, ${videoProviderKey}`);
});

afterAll(async () => {
  await pool.end();
});

describe("limite de vídeos", () => {
  it("deve começar com 20 vídeos por mês e o vídeo de exemplo", async () => {
    expect(await getVideoSettings(db)).toEqual({
      limit: { count: 20, period: "month" },
      chosen: null,
    });
  });

  it("deve guardar e trocar a quantidade e o período", async () => {
    await saveVideoLimit(db, { count: 3, period: "day" }, NOW);
    await saveVideoLimit(db, { count: 5, period: "week" }, NOW);

    expect((await getVideoSettings(db)).limit).toEqual({
      count: 5,
      period: "week",
    });
    expect(await db.select().from(videoSettings)).toHaveLength(1);
  });

  it("deve voltar ao padrão quando o período salvo não existe mais", async () => {
    await db
      .insert(videoSettings)
      .values({ id: 1, limitCount: 3, limitPeriod: "ano" });

    expect((await getVideoSettings(db)).limit).toEqual({
      count: 20,
      period: "month",
    });
  });
});

describe("chaves das IAs", () => {
  it("deve guardar a chave cifrada e mostrar só que ela existe", async () => {
    await saveGoogleKey();

    const [row] = await db.select().from(videoProviderKey);

    expect(row?.keyCiphertext).not.toContain("AIzaChaveDeTeste123");
    expect(decryptVideoKey(row?.keyCiphertext ?? "", SECRET)).toBe(
      "AIzaChaveDeTeste123",
    );
    expect(await listSavedVideoKeys(db)).toEqual([
      { provider: "google", updatedAt: NOW },
    ]);
  });

  it("deve trocar a chave sem criar outra linha", async () => {
    await saveGoogleKey();
    await saveVideoKey(
      db,
      { provider: "google", plainKey: "AIzaOutraChave456", secret: SECRET },
      NOW,
    );

    const rows = await db.select().from(videoProviderKey);

    expect(rows).toHaveLength(1);
    expect(decryptVideoKey(rows[0]?.keyCiphertext ?? "", SECRET)).toBe(
      "AIzaOutraChave456",
    );
  });

  it("deve dizer que não tirou nada quando não havia chave", async () => {
    expect(await removeVideoKey(db, "google", NOW)).toBe(false);
  });
});

describe("IA escolhida", () => {
  it("não deve escolher um serviço sem chave", async () => {
    expect(await chooseVideoModel(db, GOOGLE_MODEL, NOW)).toEqual({
      ok: false,
      reason: "missing-key",
    });
    expect((await getVideoSettings(db)).chosen).toBeNull();
  });

  it("não deve escolher um modelo que o serviço não tem", async () => {
    await saveGoogleKey();

    const result = await chooseVideoModel(
      db,
      { provider: "google", model: "veo-3.1-fast-generate-preview" },
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown-model" });
  });

  it("deve escolher o modelo e manter o limite padrão", async () => {
    await saveGoogleKey();

    await chooseVideoModel(db, GOOGLE_MODEL, NOW);

    expect(await getVideoSettings(db)).toEqual({
      limit: { count: 20, period: "month" },
      chosen: GOOGLE_MODEL,
    });
  });

  it("deve voltar para o vídeo de exemplo quando a chave em uso é tirada", async () => {
    await saveGoogleKey();
    await chooseVideoModel(db, GOOGLE_MODEL, NOW);

    expect(await removeVideoKey(db, "google", NOW)).toBe(true);

    expect((await getVideoSettings(db)).chosen).toBeNull();
    expect(await listSavedVideoKeys(db)).toEqual([]);
  });

  it("deve voltar para o vídeo de exemplo quando o admin escolhe", async () => {
    await saveGoogleKey();
    await chooseVideoModel(db, GOOGLE_MODEL, NOW);

    await clearVideoModel(db, NOW);

    expect((await getVideoSettings(db)).chosen).toBeNull();
  });
});

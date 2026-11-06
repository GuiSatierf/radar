import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { videoProviderKey, videoSettings } from "@/db/schema";
import {
  selectVideoGenerator,
  VideoAiUnavailableError,
} from "./select-video-generator";
import { chooseVideoModel, saveVideoKey } from "./settings";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const NOW = new Date("2026-11-05T15:00:00Z");
const SECRET = "segredo-de-teste-das-chaves-com-mais-de-32";
const REQUEST = {
  productName: "Garrafa térmica",
  productImageUrl: null,
  format: "hands",
} as const;

async function chooseGeminiWithKey(): Promise<void> {
  await saveVideoKey(
    db,
    { provider: "google", plainKey: "AIzaChaveDeTeste123", secret: SECRET },
    NOW,
  );
  await chooseVideoModel(
    db,
    { provider: "google", model: "gemini-omni-1.2-flash" },
    NOW,
  );
}

beforeEach(async () => {
  await db.execute(sql`truncate table ${videoSettings}, ${videoProviderKey}`);
});

afterAll(async () => {
  await pool.end();
});

describe("selectVideoGenerator", () => {
  it("deve usar o vídeo de exemplo quando nenhuma IA foi escolhida", async () => {
    const generator = await selectVideoGenerator(db, SECRET);

    expect(generator.name).toBe("sample");
  });

  it("deve usar o Gemini escolhido com a chave salva", async () => {
    await chooseGeminiWithKey();

    const generator = await selectVideoGenerator(db, SECRET);

    expect(generator.name).toBe("google:gemini-omni-1.2-flash");
  });

  it("deve falhar o vídeo, sem trocar pelo exemplo, quando o segredo das chaves mudou", async () => {
    await chooseGeminiWithKey();

    const generator = await selectVideoGenerator(
      db,
      "outro-segredo-das-chaves-com-mais-de-32-letras",
    );

    await expect(generator.generate(REQUEST)).rejects.toBeInstanceOf(
      VideoAiUnavailableError,
    );
  });

  it("deve falhar o vídeo quando o segredo das chaves não está configurado", async () => {
    await chooseGeminiWithKey();

    const generator = await selectVideoGenerator(db, undefined);

    await expect(generator.generate(REQUEST)).rejects.toThrow(
      "VIDEO_KEYS_SECRET is not set",
    );
  });

  it("deve falhar o vídeo quando a chave da IA escolhida sumiu", async () => {
    await chooseGeminiWithKey();
    await db.execute(sql`truncate table ${videoProviderKey}`);

    const generator = await selectVideoGenerator(db, SECRET);

    await expect(generator.generate(REQUEST)).rejects.toThrow(
      "no key saved for google",
    );
  });
});

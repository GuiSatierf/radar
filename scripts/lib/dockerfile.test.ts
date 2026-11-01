import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/** The image the production build starts from (the first FROM line). */
async function baseImage(): Promise<string | null> {
  const dockerfile = await readFile("Dockerfile", "utf8");
  const line = dockerfile
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text.startsWith("FROM "));

  if (line == null) return null;

  return line.split(/\s+/)[1] ?? null;
}

describe("imagem de produção", () => {
  it("deve usar um patch exato do Node 24, para saber qual Node está no ar", async () => {
    // A loose tag (node:24-alpine) let the server keep an old cached image with known flaws.
    expect(await baseImage()).toMatch(/^node:24\.\d+\.\d+-alpine$/);
  });
});

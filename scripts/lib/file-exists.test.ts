import { describe, expect, it } from "vitest";
import { fileExists } from "./file-exists";

describe("fileExists", () => {
  it("deve dizer que um arquivo existente existe", async () => {
    expect(await fileExists("package.json")).toBe(true);
  });

  it("deve devolver false quando o arquivo não existe", async () => {
    expect(await fileExists("nao-existe-este-arquivo.txt")).toBe(false);
  });
});

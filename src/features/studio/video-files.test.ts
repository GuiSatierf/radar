import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InvalidVideoIdError,
  parseByteRange,
  readVideoFileSize,
  removeVideoFiles,
  saveVideoFile,
  videoFilePath,
} from "./video-files";

const VIDEO_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("arquivos de vídeo", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "studio-videos-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("deve guardar o vídeo e ler o tamanho de volta", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await saveVideoFile(path.join(directory, "novo"), VIDEO_ID, bytes);
    const size = await readVideoFileSize(
      path.join(directory, "novo"),
      VIDEO_ID,
    );
    const saved = await readFile(
      videoFilePath(path.join(directory, "novo"), VIDEO_ID),
    );

    expect(size).toBe(4);
    expect(new Uint8Array(saved)).toEqual(bytes);
  });

  it("deve dizer que não tem tamanho quando o arquivo não existe", async () => {
    const size = await readVideoFileSize(directory, VIDEO_ID);

    expect(size).toBeNull();
  });

  it("deve tratar um arquivo vazio como ausente", async () => {
    await saveVideoFile(directory, VIDEO_ID, new Uint8Array([]));

    const size = await readVideoFileSize(directory, VIDEO_ID);

    expect(size).toBeNull();
  });

  it("deve apagar os arquivos e aceitar os que já não existem", async () => {
    await saveVideoFile(directory, VIDEO_ID, new Uint8Array([1]));
    const missingId = "00000000-0000-4000-8000-000000000000";

    await removeVideoFiles(directory, [VIDEO_ID, missingId]);

    expect(await readVideoFileSize(directory, VIDEO_ID)).toBeNull();
  });

  it("deve recusar um id que sairia da pasta", () => {
    expect(() => videoFilePath(directory, "../../etc/passwd")).toThrow(
      InvalidVideoIdError,
    );
  });
});

describe("parseByteRange", () => {
  it("deve mandar o arquivo inteiro quando não há Range", () => {
    expect(parseByteRange(null, 100)).toBe("whole");
  });

  it("deve ler o pedaço com início e fim", () => {
    expect(parseByteRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
  });

  it("deve ir até o fim quando o pedido não tem fim", () => {
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
  });

  it("deve cortar o fim no tamanho do arquivo", () => {
    expect(parseByteRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
  });

  it("deve ler os últimos bytes pedidos", () => {
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("deve recusar início depois do fim do arquivo", () => {
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
  });

  it("deve mandar o arquivo inteiro quando o início é maior que o fim, porque o pedido é inválido", () => {
    expect(parseByteRange("bytes=20-10", 100)).toBe("whole");
  });

  it("deve mandar o arquivo inteiro quando o pedido não diz início nem fim", () => {
    expect(parseByteRange("bytes=-", 100)).toBe("whole");
  });

  it("deve recusar pedido de zero bytes do fim", () => {
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });

  it("deve mandar o arquivo inteiro quando pedem vários pedaços", () => {
    expect(parseByteRange("bytes=0-1,5-6", 100)).toBe("whole");
  });
});

import { describe, expect, it } from "vitest";
import { isVideoFormat } from "./formats";
import { describeVideoDay, shouldNudgeWorker, videoFileName } from "./library";

describe("videoFileName", () => {
  it("deve tirar acentos, espaços e símbolos do nome do produto", () => {
    expect(videoFileName("Garrafa Térmica 1L, inox!")).toBe(
      "garrafa-termica-1l-inox.mp4",
    );
  });

  it("deve encurtar nomes muito longos", () => {
    const name = videoFileName(`${"a".repeat(100)} b`);

    expect(name).toBe(`${"a".repeat(60)}.mp4`);
  });

  it("deve usar um nome padrão quando não sobra letra nenhuma", () => {
    expect(videoFileName("   ")).toBe("video.mp4");
    expect(videoFileName("★★★")).toBe("video.mp4");
  });
});

describe("describeVideoDay", () => {
  const now = new Date("2026-10-30T15:00:00Z");

  it("deve dizer hoje e ontem pelo calendário de Brasília", () => {
    expect(describeVideoDay(new Date("2026-10-30T03:30:00Z"), now)).toBe(
      "hoje",
    );
    // 30/10 02:00 UTC is still 29/10 in Brasília.
    expect(describeVideoDay(new Date("2026-10-30T02:00:00Z"), now)).toBe(
      "ontem",
    );
  });

  it("deve mostrar dia e mês para datas mais antigas", () => {
    expect(describeVideoDay(new Date("2026-10-20T15:00:00Z"), now)).toBe(
      "20/10",
    );
  });
});

describe("isVideoFormat", () => {
  it("deve aceitar só os três formatos", () => {
    expect(isVideoFormat("hands")).toBe(true);
    expect(isVideoFormat("scene")).toBe(true);
    expect(isVideoFormat("avatar")).toBe(false);
    expect(isVideoFormat(null)).toBe(false);
  });
});

describe("shouldNudgeWorker", () => {
  const now = new Date("2026-10-30T15:00:00Z");

  it("não deve chamar o trabalho quando não tem vídeo esperando", () => {
    expect(shouldNudgeWorker(null, now)).toBe(false);
  });

  it("deve esperar o trabalho que o clique já começou", () => {
    expect(shouldNudgeWorker(new Date("2026-10-30T14:59:45Z"), now)).toBe(
      false,
    );
  });

  it("deve chamar o trabalho quando o vídeo espera há 30 segundos ou mais", () => {
    expect(shouldNudgeWorker(new Date("2026-10-30T14:59:30Z"), now)).toBe(true);
  });
});

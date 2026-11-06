import { describe, expect, it } from "vitest";
import { buildVideoPrompt } from "./video-prompt";

describe("buildVideoPrompt", () => {
  it("deve pedir o produto igual ao da foto quando há foto", () => {
    const prompt = buildVideoPrompt({
      productName: "Garrafa térmica 500ml",
      format: "hands",
      hasPhoto: true,
    });

    expect(prompt).toContain('"Garrafa térmica 500ml"');
    expect(prompt).toContain("exactly as in the photo");
    expect(prompt).toContain("Only a person's hands appear");
  });

  it("não deve falar de foto quando o produto não tem", () => {
    const prompt = buildVideoPrompt({
      productName: "Luminária de mesa",
      format: "scene",
      hasPhoto: false,
    });

    expect(prompt).not.toContain("photo");
    expect(prompt).toContain("No people.");
  });

  it("deve pôr o nome longo numa linha só e cortar em 120 caracteres", () => {
    const longName = `Kit organizador\nde gaveta ${"multiuso ".repeat(30)}`;

    const prompt = buildVideoPrompt({
      productName: longName,
      format: "point-of-view",
      hasPhoto: false,
    });
    const quoted = prompt.match(/"([^"]*)"/)?.[1] ?? "";

    expect(quoted).not.toContain("\n");
    expect(quoted.length).toBeLessThanOrEqual(121);
    expect(quoted.endsWith("…")).toBe(true);
  });

  it("deve pedir sempre sem fala e sem texto na tela", () => {
    const prompt = buildVideoPrompt({
      productName: "Fone sem fio",
      format: "hands",
      hasPhoto: true,
    });

    expect(prompt).toContain("No speech or narration");
    expect(prompt).toContain("No on-screen text");
  });
});

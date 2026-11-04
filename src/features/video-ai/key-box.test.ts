import { describe, expect, it } from "vitest";
import {
  decryptVideoKey,
  encryptVideoKey,
  UnreadableVideoKeyError,
} from "./key-box";

const SECRET = "um-segredo-de-teste-com-mais-de-32-caracteres";
const API_KEY = "AIzaChaveDeTeste123";

describe("encryptVideoKey", () => {
  it("deve guardar a chave sem que ela apareça no texto salvo", () => {
    const stored = encryptVideoKey(API_KEY, SECRET);

    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain(API_KEY);
  });

  it("deve dar textos diferentes para a mesma chave", () => {
    expect(encryptVideoKey(API_KEY, SECRET)).not.toBe(
      encryptVideoKey(API_KEY, SECRET),
    );
  });
});

describe("decryptVideoKey", () => {
  it("deve ler de volta a chave guardada", () => {
    const stored = encryptVideoKey(API_KEY, SECRET);

    expect(decryptVideoKey(stored, SECRET)).toBe(API_KEY);
  });

  it("deve recusar quando o segredo mudou", () => {
    const stored = encryptVideoKey(API_KEY, SECRET);

    expect(() =>
      decryptVideoKey(stored, "outro-segredo-de-teste-com-mais-de-32-letras"),
    ).toThrow(UnreadableVideoKeyError);
  });

  it("deve recusar texto salvo alterado", () => {
    const stored = encryptVideoKey(API_KEY, SECRET);
    const tampered = `${stored.slice(0, -4)}AAAA`;

    expect(() => decryptVideoKey(tampered, SECRET)).toThrow(
      UnreadableVideoKeyError,
    );
  });

  it.each([
    ["sem o formato", "abc"],
    ["curto demais", "v1:AAAA"],
  ])("deve recusar texto %s", (_, stored) => {
    expect(() => decryptVideoKey(stored, SECRET)).toThrow(
      UnreadableVideoKeyError,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  fractionToBasisPoints,
  InvalidDecimalError,
  shiftDecimal,
  toCents,
  toTenths,
} from "./decimal";
import { buildAuthorizationHeader } from "./signature";

describe("buildAuthorizationHeader", () => {
  it("deve assinar AppId + Timestamp + corpo + Secret com SHA-256", () => {
    // Expected hash computed outside the code: sha256('1234561700000000{"query":"{ x }"}segredo').
    const header = buildAuthorizationHeader({
      appId: "123456",
      secret: "segredo",
      timestampSeconds: 1_700_000_000,
      payload: '{"query":"{ x }"}',
    });

    expect(header).toBe(
      "SHA256 Credential=123456, Timestamp=1700000000, Signature=d12a33877a43df2c9e177d7aa2363990300b6ae5e108428c46c3d24d4036d900",
    );
  });
});

describe("conversão de decimais da API", () => {
  it("deve converter reais em centavos sem erro de arredondamento", () => {
    expect(toCents("24.30")).toBe(2430);
    expect(toCents("24.3")).toBe(2430);
    expect(toCents("15")).toBe(1500);
    expect(toCents("0.29")).toBe(29);
  });

  it("deve converter taxa em fração para pontos-base", () => {
    expect(fractionToBasisPoints("0.13")).toBe(1300);
    expect(fractionToBasisPoints("0.0029")).toBe(29);
    expect(fractionToBasisPoints("0")).toBe(0);
  });

  it("deve arredondar a nota para décimos, meio para cima", () => {
    expect(toTenths("4.85")).toBe(49);
    expect(toTenths("4.84")).toBe(48);
    expect(toTenths("5")).toBe(50);
  });

  it("deve arredondar a casa que sobra, meio para cima", () => {
    expect(shiftDecimal("24.305", 2)).toBe(2431);
    expect(shiftDecimal("24.304", 2)).toBe(2430);
  });

  it("deve recusar texto que não é número decimal positivo", () => {
    expect(() => toCents("-1")).toThrow(InvalidDecimalError);
    expect(() => toCents("1,50")).toThrow(InvalidDecimalError);
    expect(() => toCents("")).toThrow(InvalidDecimalError);
    expect(() => toCents("NaN")).toThrow(InvalidDecimalError);
  });
});

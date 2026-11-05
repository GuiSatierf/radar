import { describe, expect, it } from "vitest";
import { describePlanOrigin } from "./plan-origin";

const ENDS_AT = new Date("2026-11-12T12:00:00Z");

describe("describePlanOrigin", () => {
  it("deve dizer Hotmart quando o acesso da conta é o da compra que está valendo", () => {
    expect(describePlanOrigin("full", { plan: "full", endsAt: null })).toEqual({
      kind: "hotmart",
      endsAt: null,
    });
  });

  it("deve levar a data de fim quando a assinatura foi cancelada", () => {
    expect(
      describePlanOrigin("full", { plan: "full", endsAt: ENDS_AT }),
    ).toEqual({ kind: "hotmart", endsAt: ENDS_AT });
  });

  it("deve dizer que foi o admin quando há acesso sem nenhuma compra", () => {
    expect(describePlanOrigin("full", undefined)).toEqual({
      kind: "manual",
    });
  });

  it("não deve mostrar origem para conta sem acesso", () => {
    expect(describePlanOrigin("none", undefined)).toEqual({ kind: "none" });
  });

  it("deve dizer que foi o admin quando ele tirou o acesso de quem comprou", () => {
    expect(describePlanOrigin("none", { plan: "full", endsAt: null })).toEqual({
      kind: "manual",
    });
  });
});

import { describe, expect, it } from "vitest";
import { describePlanOrigin } from "./plan-origin";

const ENDS_AT = new Date("2026-11-12T12:00:00Z");

describe("describePlanOrigin", () => {
  it("deve dizer Hotmart quando o plano da conta é o da compra que está valendo", () => {
    expect(
      describePlanOrigin("radar", { plan: "radar", endsAt: null }),
    ).toEqual({ kind: "hotmart", endsAt: null });
  });

  it("deve levar a data de fim quando a assinatura foi cancelada", () => {
    expect(
      describePlanOrigin("radar", { plan: "radar", endsAt: ENDS_AT }),
    ).toEqual({ kind: "hotmart", endsAt: ENDS_AT });
  });

  it("deve dizer que foi o admin quando o plano é diferente da compra", () => {
    expect(describePlanOrigin("pro", { plan: "radar", endsAt: null })).toEqual({
      kind: "manual",
    });
  });

  it("deve dizer que foi o admin quando há plano sem nenhuma compra", () => {
    expect(describePlanOrigin("completo", undefined)).toEqual({
      kind: "manual",
    });
  });

  it("não deve mostrar origem para conta sem plano", () => {
    expect(describePlanOrigin("none", undefined)).toEqual({ kind: "none" });
  });

  it("deve dizer que foi o admin quando ele tirou o plano de quem comprou", () => {
    expect(describePlanOrigin("none", { plan: "radar", endsAt: null })).toEqual(
      {
        kind: "manual",
      },
    );
  });
});

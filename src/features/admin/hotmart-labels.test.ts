import { describe, expect, it } from "vitest";
import {
  describeHotmartEvent,
  describeHotmartOutcome,
  HOTMART_KIND_LABEL,
} from "./hotmart-labels";

describe("describeHotmartEvent", () => {
  it("deve traduzir os avisos que a Hotmart manda", () => {
    expect(describeHotmartEvent("PURCHASE_APPROVED")).toBe("Compra aprovada");
    expect(describeHotmartEvent("SUBSCRIPTION_CANCELLATION")).toBe(
      "Assinatura cancelada",
    );
  });

  it("deve mostrar o nome original de um aviso desconhecido", () => {
    expect(describeHotmartEvent("CLUB_FIRST_ACCESS")).toBe("CLUB_FIRST_ACCESS");
  });
});

describe("describeHotmartOutcome", () => {
  it("deve dizer o que o aviso fez quando foi aplicado", () => {
    expect(
      describeHotmartOutcome({ outcome: "applied", detail: "grant" }),
    ).toEqual({ applied: true, label: "Acesso liberado" });
    expect(
      describeHotmartOutcome({ outcome: "applied", detail: "end" }),
    ).toEqual({
      applied: true,
      label: "Fim do acesso marcado",
    });
  });

  it("deve explicar por que o aviso foi ignorado", () => {
    expect(
      describeHotmartOutcome({
        outcome: "ignored",
        detail: "product not mapped to a plan",
      }),
    ).toEqual({ applied: false, label: "Produto que não libera acesso" });
  });

  it("deve cair num texto genérico quando não conhece o motivo", () => {
    expect(
      describeHotmartOutcome({ outcome: "ignored", detail: null }),
    ).toEqual({
      applied: false,
      label: "Ignorado",
    });
  });
});

describe("describeHotmartOutcome enquanto os planos não são liberados", () => {
  it("deve mostrar que o aviso só foi registrado", () => {
    expect(
      describeHotmartOutcome({ outcome: "received", detail: null }),
    ).toEqual({ applied: false, label: "Registrado" });
  });
});

describe("HOTMART_KIND_LABEL", () => {
  it("deve dar um nome em português para cada tipo de código da Hotmart", () => {
    expect(HOTMART_KIND_LABEL).toEqual({
      plano: "Assinatura",
      produto: "Produto",
    });
  });
});

import { describe, expect, it } from "vitest";
import { canUseTool, listLockedTools } from "./access";
import { cheapestPlanWith, isPlanId, PLANS, TOOLS } from "./plans";

const subscriber = (plan: "none" | "radar" | "completo" | "pro") => ({
  plan,
  isAdmin: false,
});

describe("acesso por plano", () => {
  it("deve fechar todas as ferramentas para quem ainda não tem plano", () => {
    expect(listLockedTools(subscriber("none"))).toEqual([...TOOLS]);
  });

  it("deve abrir só Radar, Rankings e Anúncios no plano Radar", () => {
    const plan = subscriber("radar");

    expect(TOOLS.filter((tool) => canUseTool(plan, tool))).toEqual([
      "radar",
      "rankings",
      "anuncios",
    ]);
    expect(listLockedTools(plan)).toEqual(["creators", "studio"]);
  });

  it("deve abrir tudo nos planos Completo e Pro", () => {
    expect(listLockedTools(subscriber("completo"))).toEqual([]);
    expect(listLockedTools(subscriber("pro"))).toEqual([]);
  });

  it("deve abrir tudo para o admin, mesmo sem plano", () => {
    expect(listLockedTools({ plan: "none", isAdmin: true })).toEqual([]);
  });
});

describe("planos", () => {
  it("deve indicar o plano mais barato que tem a ferramenta", () => {
    expect(cheapestPlanWith("rankings")?.id).toBe("radar");
    expect(cheapestPlanWith("studio")?.id).toBe("completo");
  });

  it("deve aceitar só os planos que existem", () => {
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("ouro")).toBe(false);
    expect(isPlanId(null)).toBe(false);
  });

  it("deve ter mais vídeos no Pro que no Completo, e nenhum sem Studio", () => {
    expect(PLANS.pro.monthlyVideos).toBeGreaterThan(
      PLANS.completo.monthlyVideos,
    );
    expect(PLANS.radar.monthlyVideos).toBe(0);
    expect(PLANS.none.monthlyVideos).toBe(0);
  });
});

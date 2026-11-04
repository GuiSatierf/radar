import { describe, expect, it } from "vitest";
import { canUseTool, listLockedTools } from "./access";
import { isPlanId, PLANS, TOOLS } from "./plans";

const subscriber = (plan: "none" | "full") => ({
  plan,
  isAdmin: false,
});

describe("acesso às ferramentas", () => {
  it("deve fechar todas as ferramentas para quem ainda não tem acesso", () => {
    expect(listLockedTools(subscriber("none"))).toEqual([...TOOLS]);
  });

  it("deve abrir todas as ferramentas para quem tem acesso", () => {
    const access = subscriber("full");

    expect(TOOLS.filter((tool) => canUseTool(access, tool))).toEqual([
      ...TOOLS,
    ]);
    expect(listLockedTools(access)).toEqual([]);
  });

  it("deve abrir tudo para o admin, mesmo sem acesso liberado", () => {
    expect(listLockedTools({ plan: "none", isAdmin: true })).toEqual([]);
  });
});

describe("tipos de acesso", () => {
  it("deve aceitar só os acessos que existem, e não os planos antigos", () => {
    expect(isPlanId("full")).toBe(true);
    expect(isPlanId("pro")).toBe(false);
    expect(isPlanId("radar")).toBe(false);
    expect(isPlanId(null)).toBe(false);
  });

  it("deve ter vídeos só para quem tem acesso", () => {
    expect(PLANS.full.monthlyVideos).toBeGreaterThan(0);
    expect(PLANS.none.monthlyVideos).toBe(0);
  });
});

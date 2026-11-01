import { describe, expect, it } from "vitest";
import { TOOLS } from "@/features/plans/plans";
import {
  findNavigationItem,
  isActivePath,
  TOOL_NAVIGATION,
} from "./navigation";

describe("isActivePath", () => {
  it("deve marcar a própria rota e as rotas filhas", () => {
    expect(isActivePath("/radar", "/radar")).toBe(true);
    expect(isActivePath("/radar/produto-1", "/radar")).toBe(true);
  });

  it("não deve marcar uma rota que só começa com o mesmo texto", () => {
    expect(isActivePath("/radarzinho", "/radar")).toBe(false);
  });
});

describe("findNavigationItem", () => {
  it("deve achar as configurações, que ficam fora da lista de ferramentas", () => {
    expect(findNavigationItem("/configuracoes")?.label).toBe("Configurações");
  });

  it("deve devolver null para uma rota fora do menu", () => {
    expect(findNavigationItem("/outra")).toBeNull();
  });
});

describe("TOOL_NAVIGATION", () => {
  it("deve ter uma entrada no menu para cada ferramenta dos planos, na mesma rota", () => {
    expect(TOOL_NAVIGATION.map((item) => item.tool)).toEqual([...TOOLS]);
    expect(TOOL_NAVIGATION.every((item) => item.href === `/${item.tool}`)).toBe(
      true,
    );
  });

  it("deve achar o admin pelo título da página", () => {
    expect(findNavigationItem("/admin")?.label).toBe("Admin");
  });
});

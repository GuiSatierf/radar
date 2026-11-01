import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  PAGE_SIZE,
  parseRadarFilters,
  toSearchParams,
} from "./filters";

describe("parseRadarFilters", () => {
  it("deve usar os padrões quando a URL está vazia", () => {
    const filters = parseRadarFilters({});

    expect(filters).toEqual({
      search: null,
      category: null,
      competition: null,
      minEarningsCents: null,
      tags: [],
      sort: "nota",
      limit: PAGE_SIZE,
    });
  });

  it("deve ler todos os filtros válidos", () => {
    const filters = parseRadarFilters({
      busca: "  kit cozinha ",
      categoria: "casa-e-decoracao",
      concorrencia: "baixa",
      ganho: "2",
      etiqueta: ["natal", "comissao-extra"],
      ordem: "vendas",
      quantidade: "48",
    });

    expect(filters).toEqual({
      search: "kit cozinha",
      category: "casa-e-decoracao",
      competition: "baixa",
      minEarningsCents: 200,
      tags: ["natal", "comissao-extra"],
      sort: "vendas",
      limit: 48,
    });
  });

  it("deve ignorar cada valor inválido sem perder os outros", () => {
    const filters = parseRadarFilters({
      busca: "kit",
      categoria: "'; drop table",
      concorrencia: "nenhuma",
      ganho: "3",
      etiqueta: ["natal", "falsa", "natal"],
      ordem: "preco",
      quantidade: "99999",
    });

    expect(filters.search).toBe("kit");
    expect(filters.category).toBeNull();
    expect(filters.competition).toBeNull();
    expect(filters.minEarningsCents).toBeNull();
    expect(filters.tags).toEqual(["natal"]);
    expect(filters.sort).toBe("nota");
    expect(filters.limit).toBe(PAGE_SIZE);
  });
});

describe("toSearchParams", () => {
  it("deve voltar para a mesma URL que foi lida, sem os valores padrão", () => {
    const query =
      "categoria=casa&concorrencia=media&ganho=5&etiqueta=natal&ordem=ganho";
    const filters = parseRadarFilters(
      Object.fromEntries(
        [...new URLSearchParams(query).keys()].map((key) => [
          key,
          new URLSearchParams(query).getAll(key),
        ]),
      ),
    );

    expect(toSearchParams(filters).toString()).toBe(query);
  });
});

describe("countActiveFilters", () => {
  it("deve contar filtros e etiquetas, mas não a busca nem a ordem", () => {
    const filters = parseRadarFilters({
      busca: "kit",
      concorrencia: "baixa",
      etiqueta: ["natal", "amostra-gratis"],
      ordem: "vendas",
    });

    expect(countActiveFilters(filters)).toBe(3);
  });
});

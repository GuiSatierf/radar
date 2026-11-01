import { describe, expect, it } from "vitest";
import {
  countActiveAdFilters,
  PAGE_SIZE,
  parseAdFilters,
  toAdSearchParams,
} from "./filters";

describe("parseAdFilters", () => {
  it("deve usar mais tempo no ar e a primeira página quando não há nada na URL", () => {
    expect(parseAdFilters({})).toEqual({
      search: null,
      onlyActive: false,
      category: null,
      age: null,
      sort: "mais-tempo",
      limit: PAGE_SIZE,
    });
  });

  it("deve ler cada filtro e ignorar só o valor inválido", () => {
    const filters = parseAdFilters({
      busca: "  garrafa ",
      categoria: "casa",
      tempo: "para-sempre",
      ordem: "recentes",
      quantidade: "48",
    });

    expect(filters).toEqual({
      search: "garrafa",
      onlyActive: false,
      category: "casa",
      age: null,
      sort: "recentes",
      limit: 48,
    });
  });

  it("deve recusar quantidade fora do limite em vez de pedir milhares de linhas", () => {
    expect(parseAdFilters({ quantidade: "999999" }).limit).toBe(PAGE_SIZE);
    expect(parseAdFilters({ quantidade: "NaN" }).limit).toBe(PAGE_SIZE);
  });
});

describe("toAdSearchParams", () => {
  it("deve voltar para a mesma URL, sem os valores padrão", () => {
    const params = { busca: "kit", ativos: "1", tempo: "mais-de-3-meses" };

    const query = toAdSearchParams(parseAdFilters(params)).toString();

    expect(query).toBe("busca=kit&ativos=1&tempo=mais-de-3-meses");
  });

  it("deve contar só os filtros que ficam escondidos no botão do celular", () => {
    expect(
      countActiveAdFilters(
        parseAdFilters({
          categoria: "casa",
          tempo: "ate-1-mes",
          ativos: "1",
          busca: "x",
        }),
      ),
    ).toBe(3);
  });
});

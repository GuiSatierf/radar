import { describe, expect, it } from "vitest";
import { daysBefore } from "@/lib/calendar-day";
import { parseRankingFilters, toRankingParams } from "./filters";

describe("parseRankingFilters", () => {
  it("deve abrir em Mais vendidos, sem categoria, quando a URL está vazia", () => {
    expect(parseRankingFilters({})).toEqual({ list: "vendas", category: null });
  });

  it("deve ignorar lista e categoria inválidas", () => {
    expect(
      parseRankingFilters({ lista: "precos", categoria: "'; drop table" }),
    ).toEqual({ list: "vendas", category: null });
  });

  it("deve voltar para a mesma URL, sem os valores padrão", () => {
    const filters = parseRankingFilters({ lista: "em-alta", categoria: "pet" });

    expect(toRankingParams(filters).toString()).toBe(
      "lista=em-alta&categoria=pet",
    );
    expect(toRankingParams({ list: "vendas", category: null }).toString()).toBe(
      "",
    );
  });
});

describe("daysBefore", () => {
  it("deve voltar dias inteiros, inclusive atravessando o mês", () => {
    expect(daysBefore("2026-10-23", 7)).toBe("2026-10-16");
    expect(daysBefore("2026-11-02", 3)).toBe("2026-10-30");
  });
});

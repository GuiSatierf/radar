import { describe, expect, it } from "vitest";
import {
  calculateOpportunityScore,
  competitionComponent,
  demandComponent,
  describeOpportunity,
  earningsComponent,
  MAX_EARNINGS_CENTS_FOR_SCORE,
} from "./opportunity-score";

describe("calculateOpportunityScore", () => {
  it("deve dar 100 para nenhuma concorrência, ganho alto e muita venda", () => {
    const score = calculateOpportunityScore({
      affiliateCount: 0,
      earningsPerSaleCents: MAX_EARNINGS_CENTS_FOR_SCORE,
      monthlySales: 5_000,
    });

    expect(score).toBe(100);
  });

  it("deve dar no máximo 80 para produto que não vende, mesmo sem concorrência", () => {
    const score = calculateOpportunityScore({
      affiliateCount: 0,
      earningsPerSaleCents: 10_000,
      monthlySales: 0,
    });

    expect(score).toBe(80);
  });

  it("deve dar 0 para concorrência máxima, sem ganho e sem venda", () => {
    const score = calculateOpportunityScore({
      affiliateCount: 1_000,
      earningsPerSaleCents: 0,
      monthlySales: 0,
    });

    expect(score).toBe(0);
  });

  it("deve preferir o produto com menos afiliados quando o resto é igual", () => {
    const base = { earningsPerSaleCents: 300, monthlySales: 300 };

    const few = calculateOpportunityScore({ ...base, affiliateCount: 14 });
    const many = calculateOpportunityScore({ ...base, affiliateCount: 2_400 });

    expect(few).toBeGreaterThan(many);
  });
});

describe("contagem mínima de afiliados ('10+')", () => {
  it("deve dar meio ponto de concorrência, não o máximo, quando só sabemos o mínimo", () => {
    const base = {
      earningsPerSaleCents: 0,
      monthlySales: 0,
      affiliateCount: 10,
    };

    const minimum = calculateOpportunityScore({
      ...base,
      affiliateCountIsMinimum: true,
    });
    const exact = calculateOpportunityScore({
      ...base,
      affiliateCountIsMinimum: false,
    });

    expect(minimum).toBe(25);
    expect(exact).toBeGreaterThan(minimum);
  });
});

describe("produto sem contagem de afiliados", () => {
  it("deve dar meio ponto de concorrência, como no '10+'", () => {
    const score = calculateOpportunityScore({
      affiliateCount: null,
      earningsPerSaleCents: 0,
      monthlySales: 0,
    });

    expect(score).toBe(25);
  });

  it("não deve prometer pouca concorrência na frase quando ninguém contou", () => {
    const text = describeOpportunity(75, { isCompetitionKnown: false });

    expect(text).not.toContain("pouca concorrência");
    expect(text).toContain("ainda não contamos");
  });
});

describe("describeOpportunity", () => {
  it("deve escolher a frase pela faixa da nota, com os limites 70 e 40 inclusive", () => {
    expect(describeOpportunity(70)).toContain("Boa oportunidade");
    expect(describeOpportunity(69)).toContain("média");
    expect(describeOpportunity(40)).toContain("média");
    expect(describeOpportunity(39)).toContain("Muita concorrência");
  });
});

describe("componentes da nota", () => {
  it("deve valer o mesmo cair de 1.000 para 100 e de 100 para 10 afiliados (escala log)", () => {
    const from1000to100 = competitionComponent(99) - competitionComponent(999);
    const from100to10 = competitionComponent(9) - competitionComponent(99);

    expect(from1000to100).toBeCloseTo(from100to10, 5);
  });

  it("deve parar de subir o ganho a partir de R$ 15", () => {
    expect(earningsComponent(1_500)).toBe(1);
    expect(earningsComponent(4_000)).toBe(1);
  });

  it("deve tratar valores inválidos como zero, sem quebrar a nota", () => {
    expect(earningsComponent(Number.NaN)).toBe(0);
    expect(demandComponent(-5)).toBe(0);
    expect(competitionComponent(-5)).toBe(1);
  });
});

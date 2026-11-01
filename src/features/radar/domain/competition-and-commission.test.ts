import { describe, expect, it } from "vitest";
import { formatAffiliates } from "../components/competition-badge";
import {
  earningsPerSaleCents,
  isCommissionProfile,
  totalRateBasisPoints,
} from "./commission";
import { classifyCompetition, getCompetitionLevel } from "./competition";
import {
  formatBasisPoints,
  formatCents,
  formatCompact,
  formatMonthlySales,
  formatRating,
} from "./format";

describe("formatAffiliates", () => {
  it("deve mostrar 10+ quando o número é um mínimo, mas nunca 0+", () => {
    expect(
      formatAffiliates({ affiliateCount: 10, affiliateCountIsMinimum: true }),
    ).toBe("10+ afiliados");
    expect(
      formatAffiliates({ affiliateCount: 0, affiliateCountIsMinimum: true }),
    ).toBe("0 afiliados");
    expect(
      formatAffiliates({ affiliateCount: 1, affiliateCountIsMinimum: false }),
    ).toBe("1 afiliado");
  });
});

describe("produto sem contagem de afiliados", () => {
  it("deve mostrar 'Ainda não contamos', sem nível de concorrência", () => {
    const uncounted = { affiliateCount: null, affiliateCountIsMinimum: false };

    expect(formatAffiliates(uncounted)).toBe("Ainda não contamos");
    expect(classifyCompetition(uncounted)).toBe("sem-contagem");
  });
});

describe("getCompetitionLevel", () => {
  it("deve usar os limites 50 e 300, inclusive", () => {
    expect(getCompetitionLevel(0)).toBe("baixa");
    expect(getCompetitionLevel(50)).toBe("baixa");
    expect(getCompetitionLevel(51)).toBe("media");
    expect(getCompetitionLevel(300)).toBe("media");
    expect(getCompetitionLevel(301)).toBe("alta");
  });
});

describe("comissão", () => {
  it("deve somar a parte da Shopee do perfil com a parte da loja", () => {
    expect(
      totalRateBasisPoints({ profile: 3, sellerRateBasisPoints: 1_000 }),
    ).toBe(1_300);
    expect(totalRateBasisPoints({ profile: 8, sellerRateBasisPoints: 0 })).toBe(
      800,
    );
  });

  it("deve calcular o ganho por venda em centavos, arredondado", () => {
    const cents = earningsPerSaleCents({
      priceCents: 2_430,
      profile: 3,
      sellerRateBasisPoints: 1_000,
    });

    expect(cents).toBe(316);
  });

  it("deve aceitar só os perfis 3, 4 e 8", () => {
    expect(isCommissionProfile(4)).toBe(true);
    expect(isCommissionProfile(5)).toBe(false);
    expect(isCommissionProfile("3")).toBe(false);
  });
});

describe("formatMonthlySales", () => {
  it("deve usar o singular para uma venda e o plural para o resto", () => {
    const plain = (text: string) => text.replace(/\s/g, " ");

    expect(formatMonthlySales(1)).toBe("1 venda/mês");
    expect(formatMonthlySales(0)).toBe("0 vendas/mês");
    expect(plain(formatMonthlySales(4_300))).toBe("4,3 mil vendas/mês");
  });
});

describe("formatos", () => {
  it("deve formatar dinheiro, números grandes, porcentagem e nota em pt-BR", () => {
    // Intl separates with a non-breaking space; compare as plain text.
    const plain = (text: string) => text.replace(/\s/g, " ");

    expect(plain(formatCents(2_430))).toBe("R$ 24,30");
    expect(plain(formatCompact(19_400))).toBe("19,4 mil");
    expect(formatCompact(320)).toBe("320");
    expect(formatBasisPoints(1_300)).toBe("13%");
    expect(formatRating(49)).toBe("4,9");
  });
});

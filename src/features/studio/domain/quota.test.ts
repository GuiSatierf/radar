import { describe, expect, it } from "vitest";
import { BUSY_MESSAGE, describeQuotaBlock } from "./messages";
import {
  calculateVideoQuota,
  formatQuotaRenewal,
  InvalidVideoQuotaError,
  monthStartInBrazil,
  nextMonthStartInBrazil,
} from "./quota";

describe("calculateVideoQuota", () => {
  it("deve mostrar quantos vídeos sobram no mês", () => {
    const quota = calculateVideoQuota(12, 1);

    expect(quota).toEqual({ limit: 12, used: 1, remaining: 11 });
  });

  it("deve parar em zero quando usou tudo", () => {
    expect(calculateVideoQuota(12, 12).remaining).toBe(0);
  });

  it("nunca deve dar negativo quando o plano diminuiu no meio do mês", () => {
    expect(calculateVideoQuota(12, 30).remaining).toBe(0);
  });

  it("deve aceitar o plano sem vídeos", () => {
    expect(calculateVideoQuota(0, 0).remaining).toBe(0);
  });

  it.each([
    [-1, 0],
    [12, -1],
    [Number.NaN, 0],
    [12, Number.POSITIVE_INFINITY],
    [12.5, 0],
  ])("deve recusar limite %s e usados %s", (limit, used) => {
    expect(() => calculateVideoQuota(limit, used)).toThrow(
      InvalidVideoQuotaError,
    );
  });
});

describe("o mês de Brasília", () => {
  it("deve começar à meia-noite do dia 1 no horário de Brasília", () => {
    const now = new Date("2026-10-30T15:00:00Z");

    expect(monthStartInBrazil(now).toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
    expect(nextMonthStartInBrazil(now).toISOString()).toBe(
      "2026-11-01T03:00:00.000Z",
    );
  });

  it("ainda deve ser o mês anterior nas primeiras horas do dia 1 em UTC", () => {
    // 01/11 01:00 UTC is still 31/10 22:00 in Brasília.
    const now = new Date("2026-11-01T01:00:00Z");

    expect(monthStartInBrazil(now).toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
  });

  it("deve virar o ano em dezembro", () => {
    const now = new Date("2026-12-15T12:00:00Z");

    expect(nextMonthStartInBrazil(now).toISOString()).toBe(
      "2027-01-01T03:00:00.000Z",
    );
    expect(formatQuotaRenewal(now)).toBe("1º de janeiro");
  });

  it("deve dizer o dia em que a conta volta", () => {
    expect(formatQuotaRenewal(new Date("2026-10-30T15:00:00Z"))).toBe(
      "1º de novembro",
    );
  });
});

describe("describeQuotaBlock", () => {
  it("não deve travar quando ainda tem vídeo", () => {
    const block = describeQuotaBlock(
      calculateVideoQuota(12, 11),
      "1º de novembro",
    );

    expect(block).toBeNull();
  });

  it("deve explicar quando os vídeos do mês acabaram", () => {
    const block = describeQuotaBlock(
      calculateVideoQuota(12, 12),
      "1º de novembro",
    );

    expect(block).toBe(
      "Você usou os 12 vídeos deste mês. Novos vídeos liberam em 1º de novembro, e os que você já fez continuam aqui.",
    );
  });

  it("deve dizer que o plano não tem vídeos", () => {
    const block = describeQuotaBlock(
      calculateVideoQuota(0, 0),
      "1º de novembro",
    );

    expect(block).toBe("Seu plano não inclui vídeos.");
    expect(block).not.toBe(BUSY_MESSAGE);
  });
});

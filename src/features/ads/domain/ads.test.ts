import { describe, expect, it } from "vitest";
import {
  daysOnAir,
  formatCalendarDay,
  formatDaysOnAir,
  InvalidCalendarDayError,
  isCalendarDay,
  libraryUrlFor,
  parseLibraryAdId,
  parseProductLink,
  todayInBrazil,
} from "./ads";

describe("daysOnAir", () => {
  it("deve contar os dias do início até a última conferência", () => {
    expect(daysOnAir("2026-03-20", "2026-10-20")).toBe(214);
    expect(daysOnAir("2026-10-20", "2026-10-20")).toBe(0);
  });

  it("deve atravessar a virada do ano e o 29 de fevereiro", () => {
    expect(daysOnAir("2027-12-31", "2028-03-01")).toBe(61);
  });

  it("nunca deve dar número negativo", () => {
    expect(daysOnAir("2026-10-21", "2026-10-20")).toBe(0);
  });

  it("deve recusar data que não existe", () => {
    expect(() => daysOnAir("2026-02-31", "2026-03-01")).toThrow(
      InvalidCalendarDayError,
    );
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("20/10/2026")).toBe(false);
    expect(isCalendarDay("2026-10-20")).toBe(true);
  });
});

describe("formatDaysOnAir", () => {
  it("deve escrever o tempo no ar no singular, no plural e no primeiro dia", () => {
    expect(formatDaysOnAir(0)).toBe("Começou hoje");
    expect(formatDaysOnAir(1)).toBe("No ar há 1 dia");
    expect(formatDaysOnAir(214)).toBe("No ar há 214 dias");
  });

  it("deve dizer quanto tempo ficou no ar o anúncio que parou", () => {
    expect(formatDaysOnAir(120, false)).toBe("Parou depois de 120 dias");
    expect(formatDaysOnAir(1, false)).toBe("Parou depois de 1 dia");
  });
});

describe("formatCalendarDay", () => {
  it("deve escrever a data do jeito brasileiro, com e sem o ano", () => {
    expect(formatCalendarDay("2026-10-20", { withYear: true })).toBe(
      "20/10/2026",
    );
    expect(formatCalendarDay("2026-10-20", { withYear: false })).toBe("20/10");
  });

  it("deve recusar texto que não é data, em vez de mostrar lixo", () => {
    expect(() => formatCalendarDay("lixo", { withYear: true })).toThrow(
      InvalidCalendarDayError,
    );
  });
});

describe("todayInBrazil", () => {
  it("deve usar o dia de Brasília, não o de Londres", () => {
    // 01:30 UTC on the 21st is still 22:30 on the 20th in São Paulo.
    expect(todayInBrazil(new Date("2026-10-21T01:30:00Z"))).toBe("2026-10-20");
    expect(todayInBrazil(new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-21");
  });
});

describe("parseLibraryAdId", () => {
  it("deve tirar o número do anúncio do link da biblioteca da Meta", () => {
    expect(
      parseLibraryAdId(
        "https://www.facebook.com/ads/library/?id=1234567890123&foo=bar",
      ),
    ).toBe("1234567890123");
    expect(
      parseLibraryAdId(" https://facebook.com/ads/library?id=98765 "),
    ).toBe("98765");
  });

  it("deve recusar link de outro site, sem https ou sem número", () => {
    expect(
      parseLibraryAdId("https://evil.test/ads/library/?id=1234567890"),
    ).toBeNull();
    expect(
      parseLibraryAdId("http://www.facebook.com/ads/library/?id=1234567890"),
    ).toBeNull();
    expect(
      parseLibraryAdId("https://www.facebook.com/ads/library/?id=abc"),
    ).toBeNull();
    expect(
      parseLibraryAdId("https://www.facebook.com/profile?id=12345"),
    ).toBeNull();
    expect(parseLibraryAdId("não é link")).toBeNull();
  });

  it("deve montar o link mostrado a partir do número, nunca do texto colado", () => {
    expect(libraryUrlFor("123456")).toBe(
      "https://www.facebook.com/ads/library/?id=123456",
    );
  });
});

describe("parseProductLink", () => {
  it("deve reconhecer o link da ficha do Radar", () => {
    expect(
      parseProductLink("https://app.exemplo.test/radar/kit-silicone-3"),
    ).toEqual({ kind: "radar", productId: "kit-silicone-3" });
  });

  it("deve aceitar só o caminho da ficha, sem o endereço do site", () => {
    expect(parseProductLink("/radar/kit-silicone-3")).toEqual({
      kind: "radar",
      productId: "kit-silicone-3",
    });
    expect(parseProductLink("shopee.com.br/Kit-i.1.2")).toBeNull();
  });

  it("deve guardar o link da Shopee sem o rastreio do endereço", () => {
    expect(
      parseProductLink(
        "https://shopee.com.br/Kit-i.123.456?sp_atk=abc&xptdk=1",
      ),
    ).toEqual({ kind: "shopee", url: "https://shopee.com.br/Kit-i.123.456" });
  });

  it("deve recusar outro site e link sem https", () => {
    expect(parseProductLink("https://loja.test/produto/1")).toBeNull();
    expect(parseProductLink("http://shopee.com.br/Kit-i.1.2")).toBeNull();
    expect(parseProductLink("")).toBeNull();
  });
});

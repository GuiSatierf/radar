import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({}));

const { describeTotal } = await import("./describe-total");

describe("describeTotal", () => {
  it("deve concordar o singular e o plural, com e sem busca", () => {
    expect(describeTotal(1, "")).toBe("1 conta");
    expect(describeTotal(1, "maria")).toBe("1 conta encontrada");
    expect(describeTotal(3, "maria")).toBe("3 contas encontradas");
    expect(describeTotal(0, "ninguém")).toBe("0 contas encontradas");
  });

  it("deve avisar que a lista foi cortada quando passa de 50", () => {
    expect(describeTotal(51, "")).toMatch(
      /^51 contas\. Aparecem as 50 mais novas/,
    );
  });
});

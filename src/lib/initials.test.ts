import { describe, expect, it } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("deve usar a primeira e a última palavra", () => {
    expect(getInitials("Maria da Silva")).toBe("MS");
  });

  it("deve usar uma letra quando há uma palavra só", () => {
    expect(getInitials("prisciane")).toBe("P");
  });

  it("deve devolver ? para nome em branco", () => {
    expect(getInitials("   ")).toBe("?");
  });
});

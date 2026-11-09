import { describe, expect, it } from "vitest";
import { selectAdSource } from "./select-ad-source";

describe("selectAdSource", () => {
  it("não deve usar a fonte de exemplo enquanto não há fonte automática de verdade", () => {
    const source = selectAdSource();

    expect(source).toBeNull();
  });
});

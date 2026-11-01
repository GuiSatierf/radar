import { describe, expect, it } from "vitest";
import { containsPattern } from "./like-pattern";

describe("containsPattern", () => {
  it("deve escapar %, _ e a própria barra, para a busca não virar curinga", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });

  it("deve deixar o texto comum como está", () => {
    expect(containsPattern("garrafa")).toBe("%garrafa%");
  });
});

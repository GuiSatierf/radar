import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildLocalEnv } from "./local-env";

describe("buildLocalEnv", () => {
  it("não deve trazer admin no .env.example, para nenhum ambiente herdar o e-mail público da demonstração", async () => {
    const example = await readFile(".env.example", "utf8");

    expect(example).toMatch(/^ADMIN_EMAIL=""$/m);
  });

  it("deve pôr o segredo aleatório e tornar admin a conta de demonstração no .env local", async () => {
    const example = await readFile(".env.example", "utf8");

    const local = buildLocalEnv(example, "segredo-aleatorio");

    expect(local).toContain('BETTER_AUTH_SECRET="segredo-aleatorio"');
    expect(local).toMatch(/^ADMIN_EMAIL="demo@prisciane\.test"$/m);
  });

  it("deve deixar ADMIN_EMAIL vazio quando não há conta de demonstração", () => {
    const local = buildLocalEnv('ADMIN_EMAIL=""\n', "x");

    expect(local).toBe('ADMIN_EMAIL=""\n');
  });
});

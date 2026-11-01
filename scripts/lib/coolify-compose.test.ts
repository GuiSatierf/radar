import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/** The value given to one environment variable of the app service. */
async function appVariable(name: string): Promise<string | null> {
  const compose = await readFile("docker-compose.coolify.yml", "utf8");
  const line = compose
    .split("\n")
    .map((text) => text.trim())
    .find((text) => text.startsWith(`${name}:`));

  if (line == null) return null;

  return line.slice(name.length + 1).trim();
}

describe("instalação no Coolify", () => {
  it("deve dar ao login o endereço público sem a porta interna", async () => {
    // Coolify's SERVICE_URL_APP_3210 ends in ":3210" (the container port it routes to); the
    // browser opens the address without it, so sign-in would be refused as another origin.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Docker Compose syntax, not a JS template.
    expect(await appVariable("BETTER_AUTH_URL")).toBe("${SERVICE_URL_APP}");
  });

  it("deve continuar pedindo ao Coolify para levar o endereço até a porta 3210", async () => {
    expect(await appVariable("SERVICE_URL_APP_3210")).not.toBeNull();
  });
});

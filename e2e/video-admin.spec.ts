import { expect, test } from "@playwright/test";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

// Both browser projects run at once and share the settings, so the test only saves values that
// change nothing for the other tests: the default limit and a key nobody chooses.
const TEST_KEY = "e2e-chave-de-video-12345";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("o admin salva o limite de vídeos e a chave de uma IA pela tela", async ({
  page,
}, testInfo) => {
  const adminEmail = uniqueEmail(testInfo.title);
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);

  await page.goto("/admin/video");
  await expect(page.getByRole("heading", { name: "Vídeo com IA" })).toBeVisible(
    { timeout: NAVIGATION_TIMEOUT },
  );

  await page.getByLabel("Quantidade de vídeos").fill("12");
  await page.getByLabel("Período do limite").selectOption("month");
  await page
    .getByRole("button", { name: "Salvar", exact: true })
    .first()
    .click();
  await expect(page.getByText("Limite de vídeos salvo")).toBeVisible();

  const keyField = page.getByRole("textbox", {
    name: "Chave do Google Gemini",
  });
  await keyField.fill(TEST_KEY);
  await keyField.press("Enter");
  await expect(page.getByText("Chave do Google Gemini salva")).toBeVisible();
  await expect(keyField).toHaveValue("");

  await page.reload();
  await expect(page.getByText(/^Salva em /)).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByText(TEST_KEY)).toHaveCount(0);
  await expect(
    page
      .getByLabel("IA que cria os vídeos")
      .getByRole("option", { name: /Gemini Omni Flash/ }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Quantidade de vídeos")).toHaveValue("12");
});

test("quem não é admin não acha a página de vídeo com IA", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "full");

  const response = await page.goto("/admin/video");

  expect(response?.status()).toBe(404);
});

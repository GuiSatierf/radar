import { expect, test } from "@playwright/test";
import { purchaseEvent } from "../src/features/billing/hotmart/fixtures";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

// The same code in every run: both browser projects save it, so neither breaks the other.
const HOTTOK = "e2e-hottok-12345";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("o admin liga a Hotmart pela tela e o aviso de teste chega só registrado", async ({
  page,
}, testInfo) => {
  const adminEmail = uniqueEmail(testInfo.title);
  // Ten digits that never start with zero: Hotmart sends the code as a number.
  const planCode = String(1_000_000_000 + (Date.now() % 1_000_000_000));
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);

  await page.goto("/admin/hotmart");
  await expect(
    page.getByRole("heading", { name: "Ligar a Hotmart" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(page.getByRole("note")).toContainText(
    "Os planos ainda não são liberados sozinhos",
  );
  await expect(page.getByText("/api/webhooks/hotmart")).toBeVisible();

  await page.getByLabel("Código secreto da Hotmart").fill(HOTTOK);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Código da Hotmart salvo")).toBeVisible();
  await expect(page.getByLabel("Código secreto da Hotmart")).toHaveValue("");
  await expect(page.getByText(/^Salvo em /)).toBeVisible();

  await page.getByLabel("Código na Hotmart").fill(planCode);
  await page.getByLabel("Plano que ele libera").selectOption("pro");
  await page.getByRole("button", { name: "Adicionar" }).click();
  const row = page.getByRole("listitem").filter({ hasText: planCode });
  await expect(row).toContainText("Pro");
  // Drawn on the server: the kind's name must not come out blank.
  await expect(row).toContainText("Assinatura");

  const response = await page.request.post("/api/webhooks/hotmart", {
    headers: { "x-hotmart-hottok": HOTTOK },
    data: purchaseEvent({
      id: `e2e-${planCode}`,
      event: "PURCHASE_APPROVED",
      email: uniqueEmail(`${testInfo.title}-compradora`),
      at: Date.now(),
      planId: Number(planCode),
    }),
  });
  expect(await response.json()).toEqual({ status: "received" });

  await page.reload();
  await expect(page.getByText("Registrado").first()).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Tirar Assinatura ${planCode}` })
    .click();
  await expect(row).toHaveCount(0);
});

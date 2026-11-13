import { expect, test } from "@playwright/test";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

// Both browser projects share the catalog, so the file only names a product the Radar does not
// have: the page answers without changing what the other tests see.
const UNKNOWN_PRODUCT_FILE =
  "product_id,numero_afiliados,numero_minimo,status\n999999999999,12,False,ok\n";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("o admin envia o arquivo de afiliados e lê o que aconteceu", async ({
  page,
}, testInfo) => {
  const adminEmail = uniqueEmail(testInfo.title);
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);

  await page.goto("/admin/afiliados");
  await expect(
    page.getByRole("heading", { name: "Número de afiliados" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  const fileField = page.getByLabel(/Arquivo do robô/);
  await fileField.setInputFiles({
    name: "resultado.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("url,status\nx,ok\n"),
  });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Faltam as colunas product_id e numero_afiliados",
  );

  await fileField.setInputFiles({
    name: "resultado.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(UNKNOWN_PRODUCT_FILE),
  });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 produto não está no Radar e ficou de fora.",
  );
});

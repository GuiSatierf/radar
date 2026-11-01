import { expect, type Page, test } from "@playwright/test";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

const productLinks = (page: Page) =>
  page.getByRole("list").first().getByRole("link");

test("o Radar mostra a lista com ganho por venda e concorrência", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");

  await expect(page.getByText(/40 produtos/)).toBeVisible();
  await expect(productLinks(page).first()).toContainText("Você ganha R$");
  await expect(productLinks(page).first()).toContainText(/afiliados? ·/);
});

test("filtrar por concorrência baixa deixa só produtos com até 50 afiliados", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");
  const isPhone = (page.viewportSize()?.width ?? 0) < 768;

  if (isPhone) await page.getByRole("button", { name: /^Filtros/ }).click();

  await page.getByRole("button", { name: "Concorrência baixa" }).click();
  await expect(page).toHaveURL(/concorrencia=baixa/, {
    timeout: NAVIGATION_TIMEOUT,
  });

  if (isPhone)
    await page.getByRole("button", { name: /^Ver \d+ produtos/ }).click();

  const badges = await page.getByText(/afiliados? · /).allInnerTexts();
  expect(badges.length).toBeGreaterThan(0);
  expect(badges.every((text) => text.endsWith("· baixa"))).toBe(true);
});

test("buscar sem resultado mostra como sair do filtro", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");

  await page
    .getByRole("searchbox", { name: "Buscar produto" })
    .fill("produto que não existe");
  await page.getByRole("searchbox", { name: "Buscar produto" }).press("Enter");

  await expect(page.getByText("Nenhum produto com esses filtros")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  await page.getByRole("link", { name: "Limpar tudo" }).click();
  await expect(page.getByText(/40 produtos/)).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
});

test("a ficha do produto mostra ganho, concorrência, nota e o link da Shopee", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");

  await productLinks(page).first().click();
  await expect(page).toHaveURL(/\/radar\/demo-\d+$/, {
    timeout: NAVIGATION_TIMEOUT,
  });

  await expect(page.getByText("Você ganha por venda")).toBeVisible();
  await expect(
    page.getByText(/Concorrência (baixa|média|alta)/).first(),
  ).toBeVisible();
  await expect(page.getByText(/\d+ de 100/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Abrir na Shopee/ }),
  ).toHaveAttribute("href", /^https:\/\/shopee\.com\.br\//);
  await expect(
    page.getByRole("heading", { name: "Os vídeos com mais visualizações" }),
  ).toBeVisible();
});

test("trocar a comissão para 8% aumenta o ganho mostrado", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");
  await page.goto("/radar/demo-027");
  const at3 = await page.getByText(/% \(Shopee 3%/).innerText();

  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "8%" }).click();
  // The button switches at once; the toast means the server has saved it.
  await expect(page.getByText("Comissão da Shopee: 8%")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: "8%" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/radar/demo-027");
  await expect(page.getByText(/\(Shopee 8%/)).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  expect(at3).toContain("Shopee 3%");
});

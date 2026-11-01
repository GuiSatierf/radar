import { expect, type Page, test } from "@playwright/test";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

const adCards = (page: Page) => page.getByRole("article");
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** A recent start date, so the ad never jumps ahead of the demo ads in the list. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

test("os anúncios aparecem do que está há mais tempo no ar, com o ganho do produto", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");

  await page.goto("/anuncios");

  // The demo automatic source has the oldest ad (302 days), ahead of the manual ones.
  await expect(adCards(page).first()).toContainText("No ar há 302 dias");
  await expect(adCards(page).first()).toContainText("Você ganha R$");
  await expect(
    adCards(page)
      .first()
      .getByRole("link", { name: /Ver o anúncio de .* na biblioteca da Meta/ }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/www\.facebook\.com\/ads\/library\/\?id=\d+$/,
  );
});

test("filtrar por mais de 3 meses no ar deixa só os anúncios antigos", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");
  await page.goto("/anuncios");

  if (isPhone(page))
    await page.getByRole("button", { name: /^Filtros/ }).click();

  await page.getByRole("button", { name: "Mais de 3 meses" }).click();
  await expect(page).toHaveURL(/tempo=mais-de-3-meses/, {
    timeout: NAVIGATION_TIMEOUT,
  });

  if (isPhone(page))
    await page.getByRole("button", { name: /^Ver \d+ anúncios?/ }).click();

  const badges = await page
    .getByText(/^(No ar há|Parou depois de) \d+ dias?$/)
    .allInnerTexts();
  const days = badges.map((text) => Number(text.match(/\d+/)?.[0]));

  expect(days.length).toBeGreaterThan(0);
  expect(days.every((count) => count > 90)).toBe(true);
});

test("o admin cadastra um anúncio, que aparece para as assinantes, e depois tira", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  const adId = `9${Date.now()}`;
  await signUp(page, email);
  await makeAdmin(email);

  await page.goto("/admin/anuncios/novo");
  await page
    .getByLabel("Link do anúncio na biblioteca da Meta")
    .fill(`https://www.facebook.com/ads/library/?id=${adId}`);
  await page.getByLabel("Quem anuncia").fill(`Loja E2E ${adId}`);
  await page.getByLabel("No ar desde").fill(daysAgo(5));
  await page.getByRole("checkbox", { name: "Instagram" }).check();
  await page.getByRole("button", { name: "Salvar anúncio" }).click();

  await expect(page).toHaveURL(/\/admin\/anuncios$/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByText(`Loja E2E ${adId}`)).toBeVisible();

  await page.goto(`/anuncios?busca=${adId}`);
  await expect(adCards(page)).toHaveCount(1);
  await expect(adCards(page).first()).toContainText(
    "Produto fora do nosso catálogo.",
  );

  await page.goto("/admin/anuncios");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Tirar o anúncio de Loja E2E ${adId}` })
    .click();
  await expect(page.getByText(`Loja E2E ${adId}`)).toHaveCount(0);
});

test("quem não é admin não acha a área de anúncios do admin", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "pro");

  const response = await page.goto("/admin/anuncios/novo");

  expect(response?.status()).toBe(404);
});

test("só no ar agora tira os anúncios que pararam", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "radar");
  await page.goto("/anuncios");
  await expect(page.getByText(/^Parou depois de/).first()).toBeVisible();

  await page.goto("/anuncios?ativos=1");

  await expect(adCards(page).first()).toBeVisible();
  await expect(page.getByText(/^Parou depois de/)).toHaveCount(0);
});

test("o admin esconde um anúncio automático e as assinantes deixam de ver", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  await makeAdmin(email);
  await page.goto("/admin/anuncios?origem=automaticos");

  await page
    .getByRole("button", {
      name: "Esconder o anúncio de Supermercado Bom Preço",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Mostrar o anúncio de Supermercado Bom Preço",
    }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  await page.goto("/anuncios?busca=Supermercado");
  await expect(
    page.getByText("Nenhum anúncio com esses filtros"),
  ).toBeVisible();

  // Leave the shared demo data as it was for the other tests.
  await page.goto("/admin/anuncios?origem=automaticos");
  await page
    .getByRole("button", {
      name: "Mostrar o anúncio de Supermercado Bom Preço",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Esconder o anúncio de Supermercado Bom Preço",
    }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
});

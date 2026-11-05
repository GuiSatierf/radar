import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { product, studioVideo, user } from "../src/db/schema";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
  withTestDatabase,
} from "./support";

// The sample generator takes 3 s and the page checks again every 3 s.
const VIDEO_READY_TIMEOUT = 30_000;

/** Puts videos straight in the database for the account with this e-mail. */
async function insertVideosFor(
  email: string,
  videos: readonly { status: string; createdAt?: Date }[],
): Promise<void> {
  await withTestDatabase(async (db) => {
    const [owner] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    const [picked] = await db.select({ id: product.id }).from(product).limit(1);

    await db.insert(studioVideo).values(
      videos.map((video, index) => ({
        id: `${owner?.id}-${index}`,
        userId: owner?.id ?? "",
        productId: picked?.id ?? "",
        productName: "Produto de teste",
        format: "hands",
        ...video,
      })),
    );
  });
}

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("da ficha do produto ao vídeo pronto para baixar, gastando 1 do mês", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "full");
  await page.locator('main a[href^="/radar/"]').first().click();
  await page.getByRole("link", { name: "Criar vídeo no Studio" }).click();
  await expect(page).toHaveURL(/\/studio\?produto=/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByText("20 de 20")).toBeVisible();

  await page.getByRole("radio", { name: /No ambiente/ }).check();
  await page.getByRole("button", { name: "Gerar vídeo" }).click();

  const library = page.getByRole("region", { name: "Seus vídeos" });
  await expect(library.getByText(/Na fila|Gerando/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gerar vídeo" }),
  ).toBeDisabled();
  const download = library.getByRole("link", { name: /Baixar/ });
  await expect(download).toBeVisible({ timeout: VIDEO_READY_TIMEOUT });
  await expect(download).toHaveAttribute("download", /\.mp4$/);
  await expect(page.getByText("19 de 20")).toBeVisible();
  await expect(library.getByText(/No ambiente · hoje/)).toBeVisible();

  const response = await page.request.get(
    (await download.getAttribute("href")) ?? "",
  );
  expect(response.headers()["content-type"]).toContain("video/mp4");
});

test("escolher o produto pela lista com busca", async ({ page }, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "full");
  await page.goto("/studio");
  await expect(page.getByText("Nenhum vídeo ainda")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gerar vídeo" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Escolher produto" }).click();
  const picker = page.getByRole("dialog", { name: "Escolha o produto" });
  await picker.getByLabel("Buscar no Radar").fill("garrafa térmica");
  const option = picker.getByRole("link", { name: /Garrafa térmica/ });
  await expect(option).toBeVisible();
  await option.click();

  await expect(page).toHaveURL(/\/studio\?produto=/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await expect(page.getByText(/Garrafa térmica/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar vídeo" })).toBeEnabled();
});

test("quando os vídeos do mês acabam, o botão trava e explica até quando", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email, "full");
  await insertVideosFor(
    email,
    Array.from({ length: 20 }, () => ({ status: "expired" })),
  );

  await page.goto("/studio");

  await expect(page.getByText("0 de 20")).toBeVisible();
  await expect(
    page.getByText(
      /Você usou os 20 vídeos deste mês. Novos vídeos liberam em 1º de/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gerar vídeo" }),
  ).toBeDisabled();
});

test("um vídeo que perdeu o trabalho num deploy fica pronto ao abrir o Studio", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email, "full");
  // Queued a minute ago and never picked up: the click's worker died and no scheduled task ran.
  await insertVideosFor(email, [
    { status: "queued", createdAt: new Date(Date.now() - 60_000) },
  ]);

  await page.goto("/studio");

  await expect(
    page.getByRole("region", { name: "Seus vídeos" }).getByRole("link", {
      name: /Baixar/,
    }),
  ).toBeVisible({ timeout: VIDEO_READY_TIMEOUT });
});

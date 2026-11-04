import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { hotmartAccess, hotmartEvent, product, user } from "../src/db/schema";
import { confirmationLinkFor } from "./outbox";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  openAsNewVisitor,
  PASSWORD,
  signUp,
  uniqueEmail,
  withTestDatabase,
} from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

const toolsMenu = (page: Page) =>
  page.getByRole("navigation", { name: "Ferramentas" });

async function firstProductId(): Promise<string> {
  const [row] = await withTestDatabase((db) =>
    db.select({ id: product.id }).from(product).limit(1),
  );

  if (row == null) throw new Error("the e2e catalog is empty");

  return row.id;
}

async function planOf(email: string): Promise<string | undefined> {
  const [row] = await withTestDatabase((db) =>
    db.select({ plan: user.plan }).from(user).where(eq(user.email, email)),
  );

  return row?.plan;
}

test("conta nova vê as ferramentas fechadas, com cadeado no menu", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));

  await expect(
    page.getByRole("heading", { name: "Sua conta ainda não tem acesso" }),
  ).toBeVisible();
  await expect(
    toolsMenu(page).getByRole("link", { name: "Radar (sem acesso)" }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ produtos/)).toHaveCount(0);
});

test("sem acesso, a ficha do produto também fica fechada, mesmo abrindo o link direto", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title));

  await page.goto(`/radar/${await firstProductId()}`);

  await expect(
    page.getByRole("heading", { name: "Sua conta ainda não tem acesso" }),
  ).toBeVisible();
  await expect(page.getByText("Você ganha")).toHaveCount(0);
});

test("com acesso, todas as ferramentas abrem, até chamando a página direto", async ({
  page,
}, testInfo) => {
  await signUp(page, uniqueEmail(testInfo.title), "full");

  await expect(page.getByText(/\d+ produtos/)).toBeVisible();
  await expect(
    toolsMenu(page).getByRole("link", { name: /sem acesso/ }),
  ).toHaveCount(0);

  await page.goto("/studio");

  await expect(
    page.getByRole("heading", { name: "Criar vídeo" }),
  ).toBeVisible();
});

test("quem não é admin não acha a página do admin, e a API do admin recusa", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email, "full");
  const origin = new URL(page.url()).origin;

  const adminPage = await page.goto("/admin");
  const listUsers = await page.request.get("/api/auth/admin/list-users", {
    headers: { origin },
  });
  const banUser = await page.request.post("/api/auth/admin/ban-user", {
    headers: { origin },
    data: { userId: "qualquer" },
  });

  expect(adminPage?.status()).toBe(404);
  expect(listUsers.status()).toBe(403);
  expect(banUser.status()).toBe(403);
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
});

test("ninguém libera o próprio acesso pela API de conta", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);

  await page.request.post("/api/auth/update-user", {
    headers: { origin: new URL(page.url()).origin },
    data: { plan: "full", name: "Maria Teste" },
  });

  expect(await planOf(email)).toBe("none");
});

test("o admin libera o acesso de alguém, e a conta bloqueada sai e não entra mais", async ({
  page,
  browser,
}, testInfo) => {
  const subscriberEmail = uniqueEmail(`${testInfo.title}-assinante`);
  const subscriber = await openAsNewVisitor(browser);
  await signUp(subscriber, subscriberEmail);

  const adminEmail = uniqueEmail(`${testInfo.title}-admin`);
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);
  await page.goto("/admin");

  await page
    .getByRole("searchbox", { name: "Buscar conta" })
    .fill(subscriberEmail);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("1 conta encontrada")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });

  await page
    .getByRole("button", { name: "Liberar acesso de Maria Teste" })
    .click();
  await expect(page.getByText("Acesso de Maria Teste liberado.")).toBeVisible();

  await subscriber.goto("/studio");
  await expect(
    subscriber.getByRole("heading", { name: "Criar vídeo" }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Bloquear Maria Teste" }).click();
  await expect(page.getByText("Conta de Maria Teste bloqueada.")).toBeVisible();

  await subscriber.reload();
  await expect(subscriber).toHaveURL(/\/entrar$/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await subscriber.getByLabel("E-mail").fill(subscriberEmail);
  await subscriber.getByLabel("Senha").fill(PASSWORD);
  await subscriber.getByRole("button", { name: "Entrar" }).click();
  await expect(
    subscriber.getByRole("alert").filter({ hasText: "conta está bloqueada" }),
  ).toBeVisible();

  await subscriber.context().close();
});

test("o admin vê de onde veio o acesso e os avisos da Hotmart", async ({
  page,
  browser,
}, testInfo) => {
  const buyerEmail = uniqueEmail(`${testInfo.title}-compradora`);
  const eventId = `e2e-${Date.now()}`;
  await withTestDatabase(async (db) => {
    await db.insert(hotmartAccess).values({
      email: buyerEmail,
      productId: "e2e-produto",
      plan: "full",
      endsAt: null,
      lastEventAt: new Date(),
    });
    await db.insert(hotmartEvent).values({
      id: eventId,
      event: "PURCHASE_APPROVED",
      outcome: "applied",
      detail: "grant",
    });
  });
  const buyer = await openAsNewVisitor(browser);
  // Bought before signing up: the Hotmart access arrives once she confirms the e-mail.
  await signUp(buyer, buyerEmail);
  await buyer.goto(await confirmationLinkFor(buyerEmail));
  await expect(buyer).toHaveURL(/email=confirmado/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await buyer.context().close();

  const adminEmail = uniqueEmail(`${testInfo.title}-admin`);
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);
  await page.goto(`/admin?busca=${encodeURIComponent(buyerEmail)}`);

  await expect(page.getByText("Acesso pela Hotmart")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Tirar acesso de Maria Teste" })
    .click();
  await expect(page.getByText("Acesso de Maria Teste tirado.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Acesso mudado pelo admin")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Áreas do admin" })
    .getByRole("link", { name: "Hotmart" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Avisos da Hotmart" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await expect(page.getByText("Acesso liberado").first()).toBeVisible();
});

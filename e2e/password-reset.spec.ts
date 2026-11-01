import { expect, test } from "@playwright/test";
import { readOutbox } from "../src/sources/email/outbox-email-sender";
import { E2E_OUTBOX_DIR } from "./outbox";
import {
  assignFreshClientIp,
  NAVIGATION_TIMEOUT,
  signUp,
  uniqueEmail,
} from "./support";

const NEW_PASSWORD = "senha-nova-e2e-456";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

/** The reset link in the newest e-mail sent to this address (the e-mail goes out in background). */
async function resetLinkFor(email: string): Promise<string> {
  let link: string | null = null;

  await expect
    .poll(async () => {
      const messages = await readOutbox(E2E_OUTBOX_DIR);
      const latest = messages.filter((message) => message.to === email).at(-1);
      link =
        /https?:\/\/\S+\/reset-password\/\S+/.exec(latest?.text ?? "")?.[0] ??
        null;

      return link;
    })
    .not.toBeNull();

  if (link == null) throw new Error("no reset link");

  return link;
}

test("quem esqueceu a senha recebe o link, cria uma nova e entra com ela", async ({
  page,
  context,
}, testInfo) => {
  const email = uniqueEmail(testInfo.title);
  await signUp(page, email);
  await context.clearCookies();

  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  // Wait for the new page: filling earlier would type into the sign-in form being replaced.
  await expect(
    page.getByRole("heading", { name: "Esqueci minha senha" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Mandar o link" }).click();
  await expect(page.getByText("Confira seu e-mail")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });

  await page.goto(await resetLinkFor(email));
  await expect(page).toHaveURL(/\/nova-senha\?token=/, {
    timeout: NAVIGATION_TIMEOUT,
  });
  await page.getByLabel("Senha nova", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Repita a senha nova").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Salvar senha nova" }).click();

  await expect(page.getByText("Senha nova salva. Entre com ela.")).toBeVisible({
    timeout: NAVIGATION_TIMEOUT,
  });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/radar$/, { timeout: NAVIGATION_TIMEOUT });
});

test("um link vencido manda pedir outro", async ({ page }) => {
  await page.goto("/nova-senha?error=INVALID_TOKEN");

  await expect(page.getByText("Este link não vale mais")).toBeVisible();
  await page.getByRole("link", { name: "Pedir um link novo" }).click();
  await expect(page).toHaveURL(/\/esqueci-a-senha$/, {
    timeout: NAVIGATION_TIMEOUT,
  });
});

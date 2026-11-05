import { expect, test } from "@playwright/test";
import { confirmationLinkFor } from "./outbox";
import {
  assignFreshClientIp,
  makeAdmin,
  NAVIGATION_TIMEOUT,
  openAsNewVisitor,
  signUp,
  uniqueEmail,
} from "./support";

test.beforeEach(async ({ page }) => {
  await assignFreshClientIp(page);
});

test("o admin libera e-mails, quem cria a conta ganha o acesso ao confirmar o e-mail, e o acesso sai", async ({
  page,
  browser,
}, testInfo) => {
  const studentEmail = uniqueEmail(`${testInfo.title}-aluna`);
  const adminEmail = uniqueEmail(`${testInfo.title}-admin`);
  await signUp(page, adminEmail);
  await makeAdmin(adminEmail);

  await page.goto("/admin/acessos");
  await expect(
    page.getByRole("heading", { name: "Liberar acesso por e-mail" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  await page
    .getByLabel("E-mails para liberar")
    .fill(`${studentEmail.toUpperCase()}\nana@gmail`);
  await page.getByRole("button", { name: "Liberar" }).click();

  await expect(page.getByText("1 e-mail liberado.")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("ana@gmail");
  await expect(page.getByLabel("E-mails para liberar")).toHaveValue(
    "ana@gmail",
  );
  const row = page.getByRole("listitem").filter({ hasText: studentEmail });
  await expect(row).toContainText("Sem conta ainda");

  const student = await openAsNewVisitor(browser);
  await signUp(student, studentEmail);
  await student.goto("/studio");
  await expect(
    student.getByRole("heading", { name: "Sua conta ainda não tem acesso" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  await student.goto(await confirmationLinkFor(studentEmail));
  await student.goto("/studio");
  await expect(
    student.getByRole("heading", { name: "Criar vídeo" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  await page.reload();
  await expect(row).toContainText("Conta criada", {
    timeout: NAVIGATION_TIMEOUT,
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Tirar o acesso de ${studentEmail}` })
    .click();
  await expect(row).toHaveCount(0);

  await student.goto("/radar");
  await expect(
    student.getByRole("heading", { name: "Sua conta ainda não tem acesso" }),
  ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

  await student.context().close();
});

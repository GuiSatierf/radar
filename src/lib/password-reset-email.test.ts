import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createOutboxEmailSender,
  readOutbox,
} from "@/sources/email/outbox-email-sender";
import { selectEmailSender } from "@/sources/email/select-email-sender";
import { forgotPasswordSchema, newPasswordSchema } from "./auth-forms";
import { buildPasswordResetEmail } from "./password-reset-email";

describe("buildPasswordResetEmail", () => {
  it("deve chamar pelo primeiro nome e dizer quanto tempo o link vale", () => {
    const message = buildPasswordResetEmail({
      appName: "Prisciane",
      name: "  Maria Souza ",
      to: "maria@email.com",
      url: "https://app.test/api/auth/reset-password/abc",
    });

    expect(message.to).toBe("maria@email.com");
    expect(message.subject).toBe("Crie uma senha nova no Prisciane");
    expect(message.text).toContain("Olá, Maria!");
    expect(message.text).toContain(
      "https://app.test/api/auth/reset-password/abc",
    );
    expect(message.text).toContain("vale por 1 hora");
  });

  it("deve funcionar sem nome", () => {
    const message = buildPasswordResetEmail({
      appName: "Prisciane",
      name: " ",
      to: "a@b.com",
      url: "https://app.test/x",
    });

    expect(message.text.startsWith("Olá!")).toBe(true);
  });
});

describe("formulários de senha nova", () => {
  it("deve recusar quando as duas senhas são diferentes", () => {
    const result = newPasswordSchema.safeParse({
      password: "senha-nova-123",
      confirmPassword: "senha-nova-124",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("deve recusar senha curta e aceitar e-mail com espaços e maiúsculas", () => {
    expect(
      newPasswordSchema.safeParse({
        password: "curta",
        confirmPassword: "curta",
      }).success,
    ).toBe(false);
    expect(
      forgotPasswordSchema.parse({ email: " Maria@Email.COM " }).email,
    ).toBe("maria@email.com");
  });
});

describe("caixa de saída local", () => {
  it("deve guardar cada e-mail numa linha e ler de volta na ordem", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "outbox-"));
    const sender = createOutboxEmailSender(directory);

    expect(await readOutbox(directory)).toEqual([]);

    await sender.send({ to: "a@b.com", subject: "1", text: "um" });
    await sender.send({ to: "c@d.com", subject: "2", text: "dois" });

    const messages = await readOutbox(directory);
    expect(messages.map((message) => message.subject)).toEqual(["1", "2"]);
    await rm(directory, { recursive: true, force: true });
  });

  it("deve existir só quando a pasta da caixa de saída está configurada", () => {
    expect(selectEmailSender({})).toBeNull();
    expect(selectEmailSender({ EMAIL_OUTBOX_DIR: ".outbox" })?.name).toBe(
      "outbox",
    );
  });
});

import { describe, expect, it } from "vitest";
import { buildEmailVerificationEmail } from "./email-verification-email";

describe("buildEmailVerificationEmail", () => {
  it("deve chamar pelo primeiro nome, trazer o link e dizer quanto tempo ele vale", () => {
    const message = buildEmailVerificationEmail({
      appName: "Prisciane",
      name: "Maria Souza",
      to: "maria@email.com",
      url: "https://app.test/api/auth/verify-email?token=abc",
    });

    expect(message.to).toBe("maria@email.com");
    expect(message.subject).toBe("Confirme seu e-mail no Prisciane");
    expect(message.text).toContain("Olá, Maria!");
    expect(message.text).toContain(
      "https://app.test/api/auth/verify-email?token=abc",
    );
    expect(message.text).toContain("vale por 24 horas");
  });
});

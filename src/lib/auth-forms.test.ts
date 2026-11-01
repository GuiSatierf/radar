import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  getAuthErrorMessage,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from "./auth-forms";

const VALID_SIGN_UP = {
  name: "Maria Souza",
  email: "maria@email.com",
  password: "a".repeat(PASSWORD_MIN_LENGTH),
};

describe("signUpSchema", () => {
  it("deve aceitar dados válidos e normalizar o e-mail", () => {
    const result = signUpSchema.parse({
      ...VALID_SIGN_UP,
      email: "  Maria@Email.COM ",
    });

    expect(result.email).toBe("maria@email.com");
  });

  it("deve recusar nome em branco", () => {
    const result = signUpSchema.safeParse({ ...VALID_SIGN_UP, name: "   " });

    expect(result.success).toBe(false);
  });

  it("deve recusar e-mail inválido", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      email: "maria",
    });

    expect(result.success).toBe(false);
  });

  it("deve recusar senha um caractere abaixo do mínimo", () => {
    const result = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });

    expect(result.success).toBe(false);
  });

  it("deve aceitar senha no máximo e recusar um caractere acima", () => {
    const atLimit = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      password: "a".repeat(PASSWORD_MAX_LENGTH),
    });
    const overLimit = signUpSchema.safeParse({
      ...VALID_SIGN_UP,
      password: "a".repeat(PASSWORD_MAX_LENGTH + 1),
    });

    expect(atLimit.success).toBe(true);
    expect(overLimit.success).toBe(false);
  });
});

describe("toFieldErrors", () => {
  it("deve devolver uma mensagem por campo, a primeira encontrada", () => {
    const result = signInSchema.safeParse({ email: "x", password: "" });

    if (result.success) throw new Error("expected a validation error");

    const errors = toFieldErrors(result.error);

    expect(errors.email).toBe("Digite um e-mail válido.");
    expect(errors.password).toBe("Digite sua senha.");
  });
});

describe("getAuthErrorMessage", () => {
  it("deve traduzir um código conhecido", () => {
    const message = getAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" });

    expect(message).toBe("E-mail ou senha incorretos.");
  });

  it("deve dizer que a conta está bloqueada, em vez da mensagem genérica", () => {
    const message = getAuthErrorMessage({ code: "BANNED_USER", status: 403 });

    expect(message).toContain("bloqueada");
  });

  it("deve avisar de muitas tentativas quando o status é 429", () => {
    const message = getAuthErrorMessage({ code: "ANY", status: 429 });

    expect(message).toContain("Muitas tentativas");
  });

  it("deve usar a mensagem genérica para código desconhecido ou ausente", () => {
    const unknown = getAuthErrorMessage({ code: "SOMETHING_NEW" });
    const missing = getAuthErrorMessage({});

    expect(unknown).toBe(missing);
    expect(missing).toContain("Tente de novo");
  });
});

describe("changePasswordSchema", () => {
  const VALID = {
    currentPassword: "senha-antiga-123",
    password: "senha-nova-456",
    confirmPassword: "senha-nova-456",
  };

  it("deve aceitar a senha atual e duas senhas novas iguais", () => {
    expect(changePasswordSchema.safeParse(VALID).success).toBe(true);
  });

  it("deve pedir a senha atual", () => {
    const result = changePasswordSchema.safeParse({
      ...VALID,
      currentPassword: "",
    });

    expect(result.success).toBe(false);
    expect(result.error && toFieldErrors(result.error).currentPassword).toBe(
      "Digite a senha atual.",
    );
  });

  it("deve recusar quando a repetição não bate", () => {
    const result = changePasswordSchema.safeParse({
      ...VALID,
      confirmPassword: "outra-coisa-789",
    });

    expect(result.error && toFieldErrors(result.error).confirmPassword).toBe(
      "As duas senhas precisam ser iguais.",
    );
  });

  it("deve recusar a senha nova igual à atual", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: VALID.password,
      password: VALID.password,
      confirmPassword: VALID.password,
    });

    expect(result.error && toFieldErrors(result.error).password).toBe(
      "A senha nova precisa ser diferente da atual.",
    );
  });

  it("deve recusar senha nova um caractere abaixo do mínimo", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const result = changePasswordSchema.safeParse({
      ...VALID,
      password: short,
      confirmPassword: short,
    });

    expect(result.success).toBe(false);
  });

  it("deve dizer que a senha atual está errada quando o servidor recusa", () => {
    expect(getAuthErrorMessage({ code: "INVALID_PASSWORD" })).toBe(
      "A senha atual está errada.",
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppName,
  InvalidEnvError,
  parseServerEnv,
  resolveLogLevel,
} from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/app",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3210",
};

describe("parseServerEnv", () => {
  it("deve aplicar os valores padrão quando as variáveis opcionais faltam", () => {
    const env = parseServerEnv(VALID_ENV);

    expect(env.APP_NAME).toBe("Prisciane");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.CLIENT_IP_HEADER).toBe("x-real-ip");
  });

  it("deve tratar SUPPORT_URL vazio como sem suporte e aceitar só link https", () => {
    const blank = parseServerEnv({ ...VALID_ENV, SUPPORT_URL: " " });
    const whatsapp = parseServerEnv({
      ...VALID_ENV,
      SUPPORT_URL: "https://wa.me/5511999999999",
    });

    expect(blank.SUPPORT_URL).toBeUndefined();
    expect(whatsapp.SUPPORT_URL).toBe("https://wa.me/5511999999999");
    expect(() =>
      parseServerEnv({ ...VALID_ENV, SUPPORT_URL: "javascript:alert(1)" }),
    ).toThrow(InvalidEnvError);
  });

  it("deve falhar quando o segredo é curto demais", () => {
    const parse = () =>
      parseServerEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "x".repeat(31) });

    expect(parse).toThrow(InvalidEnvError);
  });

  it("deve falhar quando a URL do banco não é Postgres", () => {
    const parse = () =>
      parseServerEnv({ ...VALID_ENV, DATABASE_URL: "mysql://localhost/app" });

    expect(parse).toThrow(/DATABASE_URL/);
  });

  it("deve falhar quando falta uma variável obrigatória", () => {
    const parse = () =>
      parseServerEnv({ ...VALID_ENV, BETTER_AUTH_URL: undefined });

    expect(parse).toThrow(/BETTER_AUTH_URL/);
  });
});

describe("resolveLogLevel", () => {
  it("deve voltar para info quando o nível é inválido ou vazio, em vez de derrubar o logger", () => {
    expect(resolveLogLevel("warning")).toBe("info");
    expect(resolveLogLevel("")).toBe("info");
    expect(resolveLogLevel(undefined)).toBe("info");
  });

  it("deve aceitar um nível válido com maiúscula e espaço", () => {
    expect(resolveLogLevel(" WARN ")).toBe("warn");
  });
});

describe("getAppName", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deve usar o nome padrão quando APP_NAME está em branco", () => {
    vi.stubEnv("APP_NAME", "   ");

    expect(getAppName()).toBe("Prisciane");
  });

  it("deve usar APP_NAME sem espaços nas pontas", () => {
    vi.stubEnv("APP_NAME", "  Nome do Cliente ");

    expect(getAppName()).toBe("Nome do Cliente");
  });
});

describe("parseServerEnv com Resend", () => {
  const RESEND = {
    RESEND_API_KEY: "re_chave_de_teste",
    EMAIL_FROM: "Prisciane <nao-responda@exemplo.com.br>",
  };

  it("deve aceitar a chave junto com o endereço de quem envia", () => {
    const env = parseServerEnv({ ...VALID_ENV, ...RESEND });

    expect(env.RESEND_API_KEY).toBe(RESEND.RESEND_API_KEY);
    expect(env.EMAIL_FROM).toBe(RESEND.EMAIL_FROM);
  });

  it("deve tratar as duas vazias como e-mail desligado", () => {
    const env = parseServerEnv({
      ...VALID_ENV,
      RESEND_API_KEY: "",
      EMAIL_FROM: " ",
    });

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it("deve falhar com só uma das duas", () => {
    expect(() =>
      parseServerEnv({ ...VALID_ENV, RESEND_API_KEY: RESEND.RESEND_API_KEY }),
    ).toThrow(InvalidEnvError);
    expect(() =>
      parseServerEnv({ ...VALID_ENV, EMAIL_FROM: RESEND.EMAIL_FROM }),
    ).toThrow(InvalidEnvError);
  });

  it("deve recusar chave sem o começo re_ e endereço sem e-mail", () => {
    expect(() =>
      parseServerEnv({ ...VALID_ENV, ...RESEND, RESEND_API_KEY: "chave" }),
    ).toThrow(InvalidEnvError);
    expect(() =>
      parseServerEnv({ ...VALID_ENV, ...RESEND, EMAIL_FROM: "Prisciane" }),
    ).toThrow(InvalidEnvError);
  });

  it("deve aceitar o endereço sem nome", () => {
    const env = parseServerEnv({
      ...VALID_ENV,
      ...RESEND,
      EMAIL_FROM: "nao-responda@exemplo.com.br",
    });

    expect(env.EMAIL_FROM).toBe("nao-responda@exemplo.com.br");
  });
});

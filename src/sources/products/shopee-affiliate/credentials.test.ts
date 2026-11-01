import { describe, expect, it } from "vitest";
import {
  IncompleteShopeeCredentialsError,
  readShopeeCredentials,
} from "./credentials";

describe("readShopeeCredentials", () => {
  it("deve devolver null sem chave nenhuma (o app segue com o catálogo fictício)", () => {
    expect(readShopeeCredentials({})).toBeNull();
    expect(
      readShopeeCredentials({
        SHOPEE_AFFILIATE_APP_ID: " ",
        SHOPEE_AFFILIATE_SECRET: "",
      }),
    ).toBeNull();
  });

  it("deve ler a chave completa, sem espaços nas pontas", () => {
    const credentials = readShopeeCredentials({
      SHOPEE_AFFILIATE_APP_ID: " 123456 ",
      SHOPEE_AFFILIATE_SECRET: "segredo\n",
    });

    expect(credentials).toEqual({ appId: "123456", secret: "segredo" });
  });

  it("deve falhar com meia chave, em vez de seguir sem avisar", () => {
    expect(() =>
      readShopeeCredentials({ SHOPEE_AFFILIATE_APP_ID: "123456" }),
    ).toThrow(IncompleteShopeeCredentialsError);
  });
});

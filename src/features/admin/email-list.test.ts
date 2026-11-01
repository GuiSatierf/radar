import { describe, expect, it } from "vitest";
import {
  describeGrantedCount,
  MAX_EMAIL_LENGTH,
  parseEmailList,
} from "./email-list";

describe("lista de e-mails colada no admin", () => {
  it("deve aceitar um por linha, vírgula, ponto e vírgula ou espaço", () => {
    const list = parseEmailList(
      "ana@gmail.com\nbia@hotmail.com, cris@uol.com.br; davi@x.com eva@y.com",
    );

    expect(list.valid).toEqual([
      "ana@gmail.com",
      "bia@hotmail.com",
      "cris@uol.com.br",
      "davi@x.com",
      "eva@y.com",
    ]);
    expect(list.invalid).toEqual([]);
  });

  it("deve passar para minúsculas e tirar os repetidos", () => {
    const list = parseEmailList(" Ana@Gmail.com \nana@gmail.com\n\n");

    expect(list.valid).toEqual(["ana@gmail.com"]);
  });

  it("deve separar o que não é e-mail", () => {
    const list = parseEmailList("ana@gmail\nbia.hotmail.com\ncris@uol.com.br");

    expect(list.valid).toEqual(["cris@uol.com.br"]);
    expect(list.invalid).toEqual(["ana@gmail", "bia.hotmail.com"]);
  });

  it("deve deixar de fora o e-mail longo demais para ser tirado depois", () => {
    const tooLong = `${"a".repeat(MAX_EMAIL_LENGTH)}@gmail.com`;

    const list = parseEmailList(`${tooLong}\nana@gmail.com`);

    expect(list.valid).toEqual(["ana@gmail.com"]);
    expect(list.invalid).toEqual([tooLong]);
  });

  it("deve devolver listas vazias quando nada foi colado", () => {
    expect(parseEmailList("  \n , ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("contagem de e-mails liberados", () => {
  it("deve usar o singular só para um e-mail", () => {
    expect(describeGrantedCount(1)).toBe("1 e-mail liberado");
    expect(describeGrantedCount(0)).toBe("0 e-mails liberados");
    expect(describeGrantedCount(3)).toBe("3 e-mails liberados");
  });
});

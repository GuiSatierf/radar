import { describe, expect, it } from "vitest";
import {
  requireTestDatabaseName,
  UnsafeTestDatabaseError,
} from "./test-database";

describe("requireTestDatabaseName", () => {
  it("deve devolver o nome do banco quando termina em _test", () => {
    const name = requireTestDatabaseName(
      "postgres://u:p@localhost:5432/prisciane_test",
    );

    expect(name).toBe("prisciane_test");
  });

  it("deve aceitar parâmetros na URL depois do nome do banco", () => {
    const name = requireTestDatabaseName(
      "postgres://u:p@localhost:5432/prisciane_test?sslmode=disable",
    );

    expect(name).toBe("prisciane_test");
  });

  it("deve recusar o banco de desenvolvimento", () => {
    const check = () =>
      requireTestDatabaseName("postgres://u:p@localhost:5432/prisciane_dev");

    expect(check).toThrow(UnsafeTestDatabaseError);
  });

  it("deve recusar URL ausente ou em branco", () => {
    expect(() => requireTestDatabaseName(undefined)).toThrow(/missing/);
    expect(() => requireTestDatabaseName("  ")).toThrow(/missing/);
  });

  it("deve recusar nome com caractere que não pode ir direto no SQL", () => {
    const check = () =>
      requireTestDatabaseName('postgres://u:p@localhost:5432/x";drop_test');

    expect(check).toThrow(/only a-z/);
  });
});

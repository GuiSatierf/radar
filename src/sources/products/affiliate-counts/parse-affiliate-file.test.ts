import { describe, expect, it } from "vitest";
import {
  InvalidAffiliateFileError,
  MAX_FILE_CHARACTERS,
  parseAffiliateFile,
} from "./parse-affiliate-file";

const ROBOT_HEADER =
  "product_id,url,numero_afiliados,numero_minimo,estado_sincronizacao,fonte,status,timestamp";

function robotLine(fields: {
  id: string;
  count: string;
  minimum?: string;
  status?: string;
}): string {
  return [
    fields.id,
    `https://shopee.com.br/product/1/${fields.id}`,
    fields.count,
    fields.minimum ?? "False",
    "ATUALIZADO",
    "json",
    fields.status ?? "ok",
    "2026-11-12T21:20:30Z",
  ].join(",");
}

describe("parseAffiliateFile", () => {
  it("deve ler o arquivo do robô, com o 10+ como mínimo", () => {
    const file = [
      `﻿${ROBOT_HEADER}`,
      robotLine({ id: "22397737339", count: "37" }),
      robotLine({ id: "22193566084", count: "10", minimum: "True" }),
    ].join("\r\n");

    const parsed = parseAffiliateFile(file);

    expect(parsed.counts).toEqual([
      { productId: "shopee-22397737339", affiliateCount: 37, isMinimum: false },
      { productId: "shopee-22193566084", affiliateCount: 10, isMinimum: true },
    ]);
    expect(parsed.invalidCount).toBe(0);
  });

  it("deve contar sem apagar as linhas em que o robô não leu o número", () => {
    const file = [
      ROBOT_HEADER,
      robotLine({ id: "1", count: "NA", minimum: "NA", status: "pendente" }),
      robotLine({ id: "2", count: "12", status: "id_divergente" }),
      robotLine({ id: "3", count: "5" }),
    ].join("\n");

    const parsed = parseAffiliateFile(file);

    expect(parsed.counts.map((count) => count.productId)).toEqual(["shopee-3"]);
    expect(parsed.withoutCount).toBe(2);
  });

  it("deve aceitar a planilha da equipe salva pelo Excel, com ponto e vírgula", () => {
    const file = "codigo_do_produto;afiliados;minimo\n123;40;sim\n456;8;\n";

    const parsed = parseAffiliateFile(file);

    expect(parsed.counts).toEqual([
      { productId: "shopee-123", affiliateCount: 40, isMinimum: true },
      { productId: "shopee-456", affiliateCount: 8, isMinimum: false },
    ]);
  });

  it("deve apontar as linhas que não deu para ler, sem perder as boas", () => {
    const file = [
      "product_id,numero_afiliados",
      "abc,10",
      "7,1.234",
      "8,-3",
      "9,15",
    ].join("\n");

    const parsed = parseAffiliateFile(file);

    expect(parsed.counts).toHaveLength(1);
    expect(parsed.invalidCount).toBe(3);
    expect(parsed.invalidLines).toEqual([2, 3, 4]);
  });

  it("deve ficar com a última leitura quando o mesmo produto aparece duas vezes", () => {
    const file = ["product_id,numero_afiliados", "5,10", "5,12"].join("\n");

    const parsed = parseAffiliateFile(file);

    expect(parsed.counts).toEqual([
      { productId: "shopee-5", affiliateCount: 12, isMinimum: false },
    ]);
  });

  it("deve ler campo entre aspas com vírgula dentro", () => {
    const file = [
      "product_id,url,numero_afiliados",
      '5,"https://shopee.com.br/x?a=1,2",20',
    ].join("\n");

    expect(parseAffiliateFile(file).counts[0]?.affiliateCount).toBe(20);
  });

  it("deve recusar arquivo vazio, sem as colunas ou grande demais", () => {
    expect(() => parseAffiliateFile("")).toThrow(InvalidAffiliateFileError);
    expect(() => parseAffiliateFile("url,status\nx,ok")).toThrow(
      InvalidAffiliateFileError,
    );
    expect(() =>
      parseAffiliateFile("x".repeat(MAX_FILE_CHARACTERS + 1)),
    ).toThrow(InvalidAffiliateFileError);
  });
});

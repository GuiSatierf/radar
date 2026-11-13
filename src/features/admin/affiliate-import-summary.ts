import { formatInteger } from "@/features/radar/domain/format";
import type { ParsedAffiliateFile } from "@/sources/products/affiliate-counts/parse-affiliate-file";
import type { SavedAffiliateCounts } from "@/sources/products/affiliate-counts/save-affiliate-counts";

function plural(count: number, one: string, many: string): string {
  return `${formatInteger(count)} ${count === 1 ? one : many}`;
}

/** What the import did, in one short paragraph the admin can read without opening the file. */
export function describeAffiliateImport(input: {
  file: ParsedAffiliateFile;
  saved: SavedAffiliateCounts;
}): string {
  const parts = [
    `${plural(input.saved.updated, "produto atualizado", "produtos atualizados")}.`,
  ];

  if (input.saved.unknown > 0) {
    parts.push(
      `${plural(input.saved.unknown, "produto não está", "produtos não estão")} no Radar e ${input.saved.unknown === 1 ? "ficou" : "ficaram"} de fora.`,
    );
  }

  if (input.file.withoutCount > 0) {
    parts.push(
      `${plural(input.file.withoutCount, "linha veio", "linhas vieram")} sem número e ${input.file.withoutCount === 1 ? "manteve" : "mantiveram"} o número anterior.`,
    );
  }

  if (input.file.invalidCount > 0) {
    parts.push(
      `${plural(input.file.invalidCount, "linha não deu", "linhas não deram")} para ler (${input.file.invalidLines.join(", ")}${input.file.invalidCount > input.file.invalidLines.length ? " e outras" : ""}): confira o código do produto e se o número é só dígitos.`,
    );
  }

  return parts.join(" ");
}

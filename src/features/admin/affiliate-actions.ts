"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { logger } from "@/lib/logger";
import {
  InvalidAffiliateFileError,
  MAX_FILE_CHARACTERS,
  parseAffiliateFile,
} from "@/sources/products/affiliate-counts/parse-affiliate-file";
import { saveAffiliateCounts } from "@/sources/products/affiliate-counts/save-affiliate-counts";
import { describeAffiliateImport } from "./affiliate-import-summary";
import { isAdminRequest, NOT_ALLOWED_MESSAGE } from "./guard";

export type AffiliateImportResult =
  | { ok: true; summary: string }
  | { ok: false; message: string };

const FILE_MESSAGES: Record<InvalidAffiliateFileError["reason"], string> = {
  empty: "O arquivo está vazio. Escolha o arquivo resultado.csv do robô.",
  "too-large":
    "O arquivo passou de 900 KB ou de 20 mil linhas. Divida em partes menores e envie uma de cada vez.",
  "missing-columns":
    "Faltam as colunas product_id e numero_afiliados na primeira linha. Use o resultado.csv do robô sem mudar o cabeçalho.",
};

const inputSchema = z.object({
  text: z.string().max(MAX_FILE_CHARACTERS),
});

export async function importAffiliateCounts(
  input: unknown,
): Promise<AffiliateImportResult> {
  if ((await isAdminRequest()) === false) {
    return { ok: false, message: NOT_ALLOWED_MESSAGE };
  }

  const parsed = inputSchema.safeParse(input);

  if (parsed.success === false) {
    return { ok: false, message: FILE_MESSAGES["too-large"] };
  }

  try {
    const file = parseAffiliateFile(parsed.data.text);
    const saved = await saveAffiliateCounts(getDatabase(), file.counts);

    logger.info(
      {
        updated: saved.updated,
        unknown: saved.unknown,
        withoutCount: file.withoutCount,
        invalid: file.invalidCount,
      },
      "affiliate counts imported by admin",
    );
    revalidatePath("/radar");
    revalidatePath("/rankings");

    return { ok: true, summary: describeAffiliateImport({ file, saved }) };
  } catch (error) {
    if (error instanceof InvalidAffiliateFileError) {
      return { ok: false, message: FILE_MESSAGES[error.reason] };
    }

    throw error;
  }
}

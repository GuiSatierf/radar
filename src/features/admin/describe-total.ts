import { formatInteger } from "@/features/radar/domain/format";
import { ADMIN_PAGE_SIZE } from "./queries";

/** "3 contas", "1 conta encontrada", plus a hint when the list is cut. */
export function describeTotal(total: number, search: string): string {
  const isOne = total === 1;
  const noun = isOne ? "conta" : "contas";
  const found = isOne ? "encontrada" : "encontradas";
  const count = `${formatInteger(total)} ${noun}`;
  const summary = search.length === 0 ? count : `${count} ${found}`;

  if (total <= ADMIN_PAGE_SIZE) return summary;

  return `${summary}. Aparecem as ${ADMIN_PAGE_SIZE} mais novas; use a busca para achar outra.`;
}

import { z } from "zod";

export const RANKING_LISTS = ["vendas", "ganho", "em-alta"] as const;
export type RankingList = (typeof RANKING_LISTS)[number];

export const RANKING_LABEL: Record<RankingList, string> = {
  vendas: "Mais vendidos",
  ganho: "Maior ganho",
  "em-alta": "Em alta",
};

/** One plain sentence under each list, so a beginner knows what the order means. */
export const RANKING_DESCRIPTION: Record<RankingList, string> = {
  vendas:
    "Os produtos que mais vendem na Shopee agora. Muita venda costuma vir com muita concorrência.",
  ganho: "Quanto você ganha em cada venda, já com a sua comissão.",
  "em-alta": "Os produtos cujas vendas mais cresceram nos últimos dias.",
};

export const RANKING_SIZE = 30;

export interface RankingFilters {
  readonly list: RankingList;
  readonly category: string | null;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];

  return value;
}

const listSchema = z.enum(RANKING_LISTS).catch("vendas");
const categorySchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/)
  .nullable()
  .catch(null);

export function parseRankingFilters(params: RawParams): RankingFilters {
  return {
    list: listSchema.parse(firstValue(params.lista)),
    category: categorySchema.parse(firstValue(params.categoria) ?? null),
  };
}

/** Only non-default values go into the URL. */
export function toRankingParams(filters: RankingFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.list !== "vendas") params.set("lista", filters.list);
  if (filters.category != null) params.set("categoria", filters.category);

  return params;
}

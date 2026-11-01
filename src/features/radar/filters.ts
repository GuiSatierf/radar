import { z } from "zod";
import {
  COMPETITION_LEVELS,
  type CompetitionLevel,
} from "./domain/competition";

/** Everything in the Radar URL, so a filtered list can be shared or bookmarked. */
export const SORT_OPTIONS = [
  "nota",
  "concorrencia",
  "ganho",
  "vendas",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** The score already weighs competition, earnings and sales, so it works with or without counts. */
export const DEFAULT_SORT: SortOption = "nota";

export const SORT_LABEL: Record<SortOption, string> = {
  nota: "Melhor nota",
  concorrencia: "Menos concorrência",
  ganho: "Maior ganho por venda",
  vendas: "Mais vendidos",
};

export const TAG_OPTIONS = [
  "comissao-extra",
  "amostra-gratis",
  "natal",
] as const;
export type TagOption = (typeof TAG_OPTIONS)[number];

export const TAG_LABEL: Record<TagOption, string> = {
  "comissao-extra": "Comissão extra",
  "amostra-gratis": "Amostra grátis",
  natal: "Natal",
};

/** Minimum earnings per sale offered in the filter, in reais. */
export const MIN_EARNINGS_OPTIONS = [1, 2, 5, 10] as const;

export const PAGE_SIZE = 24;
const MAX_PAGE_SIZE = PAGE_SIZE * 10;
const MAX_SEARCH_LENGTH = 80;
const CENTS_PER_REAL = 100;

export interface RadarFilters {
  readonly search: string | null;
  readonly category: string | null;
  readonly competition: CompetitionLevel | null;
  readonly minEarningsCents: number | null;
  readonly tags: readonly TagOption[];
  readonly sort: SortOption;
  readonly limit: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];

  return value;
}

function allValues(value: string | string[] | undefined): string[] {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
}

// Each field falls back on its own, so one bad value never hides the others.
const searchSchema = z.string().trim().min(1).max(MAX_SEARCH_LENGTH).catch("");
const categorySchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/)
  .catch("");
const competitionSchema = z.enum(COMPETITION_LEVELS).nullable().catch(null);
const minEarningsSchema = z.coerce
  .number()
  .refine((value) => MIN_EARNINGS_OPTIONS.some((option) => option === value))
  .nullable()
  .catch(null);
const sortSchema = z.enum(SORT_OPTIONS).catch(DEFAULT_SORT);
const limitSchema = z.coerce
  .number()
  .int()
  .min(PAGE_SIZE)
  .max(MAX_PAGE_SIZE)
  .catch(PAGE_SIZE);

function blankToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

export function parseRadarFilters(params: RawParams): RadarFilters {
  const minEarnings = minEarningsSchema.parse(firstValue(params.ganho) ?? null);
  const tags = allValues(params.etiqueta).filter((tag): tag is TagOption =>
    TAG_OPTIONS.some((option) => option === tag),
  );

  return {
    search: blankToNull(searchSchema.parse(firstValue(params.busca) ?? "")),
    category: blankToNull(
      categorySchema.parse(firstValue(params.categoria) ?? ""),
    ),
    competition: competitionSchema.parse(
      firstValue(params.concorrencia) ?? null,
    ),
    minEarningsCents: minEarnings == null ? null : minEarnings * CENTS_PER_REAL,
    tags: [...new Set(tags)],
    sort: sortSchema.parse(firstValue(params.ordem)),
    limit: limitSchema.parse(firstValue(params.quantidade)),
  };
}

/** The opposite of parseRadarFilters: only non-default values go into the URL. */
export function toSearchParams(filters: RadarFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search != null) params.set("busca", filters.search);
  if (filters.category != null) params.set("categoria", filters.category);
  if (filters.competition != null)
    params.set("concorrencia", filters.competition);
  if (filters.minEarningsCents != null) {
    params.set("ganho", String(filters.minEarningsCents / CENTS_PER_REAL));
  }
  for (const tag of filters.tags) params.append("etiqueta", tag);
  if (filters.sort !== DEFAULT_SORT) params.set("ordem", filters.sort);
  if (filters.limit !== PAGE_SIZE)
    params.set("quantidade", String(filters.limit));

  return params;
}

export function countActiveFilters(filters: RadarFilters): number {
  const singles = [
    filters.category,
    filters.competition,
    filters.minEarningsCents,
  ].filter((value) => value != null).length;

  return singles + filters.tags.length;
}

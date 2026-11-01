import { z } from "zod";

/** Everything in the Anúncios URL, so a filtered list can be shared or bookmarked. */
export const AGE_OPTIONS = [
  "ate-1-mes",
  "1-a-3-meses",
  "mais-de-3-meses",
] as const;
export type AgeOption = (typeof AGE_OPTIONS)[number];

export const AGE_LABEL: Readonly<Record<AgeOption, string>> = {
  "ate-1-mes": "Até 1 mês",
  "1-a-3-meses": "1 a 3 meses",
  "mais-de-3-meses": "Mais de 3 meses",
};

/** Days on air for each option; max null means "no upper limit". */
export const AGE_RANGE: Readonly<
  Record<AgeOption, { min: number; max: number | null }>
> = {
  "ate-1-mes": { min: 0, max: 30 },
  "1-a-3-meses": { min: 31, max: 90 },
  "mais-de-3-meses": { min: 91, max: null },
};

export const SORT_OPTIONS = ["mais-tempo", "recentes"] as const;
export type AdSortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABEL: Readonly<Record<AdSortOption, string>> = {
  "mais-tempo": "Mais tempo no ar",
  recentes: "Começaram há menos tempo",
};

export const PAGE_SIZE = 24;
const MAX_PAGE_SIZE = PAGE_SIZE * 10;
const MAX_SEARCH_LENGTH = 80;

export interface AdFilters {
  readonly search: string | null;
  /** Only ads the source still finds running. */
  readonly onlyActive: boolean;
  readonly category: string | null;
  readonly age: AgeOption | null;
  readonly sort: AdSortOption;
  readonly limit: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];

  return value;
}

// Each field falls back on its own, so one bad value never hides the others.
const searchSchema = z.string().trim().min(1).max(MAX_SEARCH_LENGTH).catch("");
const categorySchema = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/)
  .catch("");
const ageSchema = z.enum(AGE_OPTIONS).nullable().catch(null);
const sortSchema = z.enum(SORT_OPTIONS).catch("mais-tempo");
const limitSchema = z.coerce
  .number()
  .int()
  .min(PAGE_SIZE)
  .max(MAX_PAGE_SIZE)
  .catch(PAGE_SIZE);

function blankToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

export function parseAdFilters(params: RawParams): AdFilters {
  return {
    search: blankToNull(searchSchema.parse(firstValue(params.busca) ?? "")),
    onlyActive: firstValue(params.ativos) === "1",
    category: blankToNull(
      categorySchema.parse(firstValue(params.categoria) ?? ""),
    ),
    age: ageSchema.parse(firstValue(params.tempo) ?? null),
    sort: sortSchema.parse(firstValue(params.ordem)),
    limit: limitSchema.parse(firstValue(params.quantidade)),
  };
}

/** The opposite of parseAdFilters: only non-default values go into the URL. */
export function toAdSearchParams(filters: AdFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search != null) params.set("busca", filters.search);
  if (filters.onlyActive) params.set("ativos", "1");
  if (filters.category != null) params.set("categoria", filters.category);
  if (filters.age != null) params.set("tempo", filters.age);
  if (filters.sort !== "mais-tempo") params.set("ordem", filters.sort);
  if (filters.limit !== PAGE_SIZE)
    params.set("quantidade", String(filters.limit));

  return params;
}

export function countActiveAdFilters(filters: AdFilters): number {
  const singles = [filters.category, filters.age].filter(
    (value) => value != null,
  ).length;

  return singles + (filters.onlyActive ? 1 : 0);
}

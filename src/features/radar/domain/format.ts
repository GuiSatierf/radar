const CENTS_PER_REAL = 100;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** 2430 → "R$ 24,30". */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / CENTS_PER_REAL);
}

/** 19400 → "19,4 mil"; small numbers stay exact ("320"). */
export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

/** 1 → "1 venda/mês"; 4300 → "4,3 mil vendas/mês". */
export function formatMonthlySales(sales: number): string {
  const noun = sales === 1 ? "venda" : "vendas";

  return `${formatCompact(sales)} ${noun}/mês`;
}

/** 1240 → "1.240". */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

/** 1300 basis points → "13%". */
export function formatBasisPoints(basisPoints: number): string {
  return percentFormatter.format(basisPoints / 10_000);
}

/** Rating stored in tenths: 49 → "4,9". */
export function formatRating(ratingTenths: number): string {
  return (ratingTenths / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Stored in UTC, shown in Brasília time. */
export function formatUpdatedAt(date: Date): string {
  return dateTimeFormatter.format(date);
}

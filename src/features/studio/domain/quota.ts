import { todayInBrazil } from "@/features/ads/domain/ads";

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
// Brazil has had no daylight saving time since 2019, so midnight there is always 03:00 UTC.
const BRAZIL_MIDNIGHT_UTC_HOUR = 3;

const monthNameFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: BRAZIL_TIME_ZONE,
});

export class InvalidVideoQuotaError extends Error {
  constructor(field: string, value: number) {
    super(`${field} must be a non-negative integer, received ${value}`);
    this.name = "InvalidVideoQuotaError";
  }
}

function brazilYearAndMonth(now: Date): { year: number; month: number } {
  const [year, month] = todayInBrazil(now).split("-").map(Number);

  if (year == null || month == null) {
    throw new Error(
      `could not read the Brazil calendar day of ${now.toISOString()}`,
    );
  }

  return { year, month };
}

/** The first instant of the current month in Brazil: the monthly video limit counts from here. */
export function monthStartInBrazil(now: Date): Date {
  const { year, month } = brazilYearAndMonth(now);

  return new Date(Date.UTC(year, month - 1, 1, BRAZIL_MIDNIGHT_UTC_HOUR));
}

/** The first instant of the next month in Brazil, when the monthly limit starts over. */
export function nextMonthStartInBrazil(now: Date): Date {
  const { year, month } = brazilYearAndMonth(now);

  // Date.UTC rolls month 12 over into January of the next year.
  return new Date(Date.UTC(year, month, 1, BRAZIL_MIDNIGHT_UTC_HOUR));
}

/** "1º de novembro": the day the monthly limit starts over, as the screen says it. */
export function formatQuotaRenewal(now: Date): string {
  return `1º de ${monthNameFormatter.format(nextMonthStartInBrazil(now))}`;
}

export interface VideoQuota {
  /** Videos the plan gives per month. */
  readonly limit: number;
  /** Videos already made this month, failed ones excluded. */
  readonly used: number;
  /** Videos still available this month, never below zero. */
  readonly remaining: number;
}

/**
 * Works out what is left of the monthly video limit.
 *
 * @param limit - Videos the plan gives per month (non-negative integer).
 * @param used - Videos made this month (non-negative integer); may exceed the limit after a plan change.
 * @throws {InvalidVideoQuotaError} When either value is negative, fractional or not finite.
 */
export function calculateVideoQuota(limit: number, used: number): VideoQuota {
  if (Number.isSafeInteger(limit) === false || limit < 0) {
    throw new InvalidVideoQuotaError("limit", limit);
  }

  if (Number.isSafeInteger(used) === false || used < 0) {
    throw new InvalidVideoQuotaError("used", used);
  }

  return { limit, used, remaining: Math.max(0, limit - used) };
}

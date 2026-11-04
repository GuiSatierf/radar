import { todayInBrazil } from "@/features/ads/domain/ads";

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
// Brazil has had no daylight saving time since 2019, so midnight there is always 03:00 UTC.
const BRAZIL_MIDNIGHT_UTC_HOUR = 3;
const DAYS_PER_WEEK = 7;

/** How often the video limit starts over. */
export const VIDEO_LIMIT_PERIODS = ["day", "week", "month"] as const;
export type VideoLimitPeriod = (typeof VIDEO_LIMIT_PERIODS)[number];

/** How many videos each person makes per period; an admin sets it. */
export interface VideoLimit {
  /** Non-negative integer; zero turns the Studio off for everyone. */
  readonly count: number;
  readonly period: VideoLimitPeriod;
}

/** What the Studio gave before the admin could change it: 12 videos a month. */
export const DEFAULT_VIDEO_LIMIT: VideoLimit = { count: 12, period: "month" };

const monthNameFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: BRAZIL_TIME_ZONE,
});
const weekRenewalFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: BRAZIL_TIME_ZONE,
});

export class InvalidVideoQuotaError extends Error {
  constructor(field: string, value: number) {
    super(`${field} must be a non-negative integer, received ${value}`);
    this.name = "InvalidVideoQuotaError";
  }
}

function brazilCalendarDay(now: Date): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = todayInBrazil(now).split("-").map(Number);

  if (year == null || month == null || day == null) {
    throw new Error(
      `could not read the Brazil calendar day of ${now.toISOString()}`,
    );
  }

  return { year, month, day };
}

/** Midnight in Brazil of a calendar day; Date.UTC rolls days and months over by itself. */
function brazilMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, BRAZIL_MIDNIGHT_UTC_HOUR));
}

/** The first instant of the current month in Brazil. */
export function monthStartInBrazil(now: Date): Date {
  const { year, month } = brazilCalendarDay(now);

  return brazilMidnight(year, month, 1);
}

/** The first instant of the next month in Brazil. */
export function nextMonthStartInBrazil(now: Date): Date {
  const { year, month } = brazilCalendarDay(now);

  return brazilMidnight(year, month + 1, 1);
}

/** Days since Monday (0 on Monday, 6 on Sunday) of the Brazil calendar day. */
function daysSinceMonday(year: number, month: number, day: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

/** The first instant of the current day, week (from Monday) or month in Brazil. */
export function periodStartInBrazil(period: VideoLimitPeriod, now: Date): Date {
  const { year, month, day } = brazilCalendarDay(now);

  if (period === "day") return brazilMidnight(year, month, day);

  if (period === "week") {
    return brazilMidnight(year, month, day - daysSinceMonday(year, month, day));
  }

  return monthStartInBrazil(now);
}

/** The first instant of the next day, week or month in Brazil, when the limit starts over. */
export function nextPeriodStartInBrazil(
  period: VideoLimitPeriod,
  now: Date,
): Date {
  const { year, month, day } = brazilCalendarDay(now);

  if (period === "day") return brazilMidnight(year, month, day + 1);

  if (period === "week") {
    const nextMonday = day - daysSinceMonday(year, month, day) + DAYS_PER_WEEK;

    return brazilMidnight(year, month, nextMonday);
  }

  return nextMonthStartInBrazil(now);
}

/**
 * When the limit starts over, ready to follow a verb: "amanhã", "na segunda-feira, 9 de novembro"
 * or "em 1º de dezembro".
 */
export function formatQuotaRenewal(
  period: VideoLimitPeriod,
  now: Date,
): string {
  if (period === "day") return "amanhã";

  const next = nextPeriodStartInBrazil(period, now);

  if (period === "week") return `na ${weekRenewalFormatter.format(next)}`;

  return `em 1º de ${monthNameFormatter.format(next)}`;
}

export interface VideoQuota {
  /** Videos each person gets per period. */
  readonly limit: number;
  /** Videos already made this period, failed ones excluded. */
  readonly used: number;
  /** Videos still available this period, never below zero. */
  readonly remaining: number;
}

/**
 * Works out what is left of the video limit.
 *
 * @param limit - Videos per period (non-negative integer).
 * @param used - Videos made this period (non-negative integer); may exceed the limit after the admin lowers it.
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

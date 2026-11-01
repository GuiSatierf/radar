/**
 * Rules for curated ads: where an ad ran, how long it has been on air and which links we accept.
 * Dates are calendar days ("2026-10-21"), as the Meta ad library shows them.
 */
export const AD_PLATFORMS = [
  "instagram",
  "facebook",
  "messenger",
  "whatsapp",
  "threads",
  "audience-network",
] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const AD_PLATFORM_LABEL: Readonly<Record<AdPlatform, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  threads: "Threads",
  "audience-network": "Audience Network",
};

export function isAdPlatform(value: unknown): value is AdPlatform {
  return AD_PLATFORMS.some((platform) => platform === value);
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export class InvalidCalendarDayError extends Error {
  constructor(value: string) {
    super(`Not a calendar day (YYYY-MM-DD): ${value}`);
    this.name = "InvalidCalendarDayError";
  }
}

/** Midnight UTC of a calendar day; throws on anything that is not a real date. */
function toUtcMidnight(day: string): number {
  const match = CALENDAR_DAY.exec(day);

  if (match == null) throw new InvalidCalendarDayError(day);

  const [, year, month, date] = match.map(Number);
  const time = Date.UTC(year ?? 0, (month ?? 0) - 1, date ?? 0);
  const roundTrip = new Date(time).toISOString().slice(0, 10);

  // 2026-02-31 silently becomes March in Date.UTC; the round trip catches it.
  if (roundTrip !== day) throw new InvalidCalendarDayError(day);

  return time;
}

export function isCalendarDay(value: string): boolean {
  try {
    toUtcMidnight(value);
    return true;
  } catch {
    // Only "is it valid?" matters here; the error itself carries nothing more.
    return false;
  }
}

/** Days between the start and the last time someone saw the ad running (never negative). */
export function daysOnAir(startedOn: string, lastSeenOn: string): number {
  const days = Math.round(
    (toUtcMidnight(lastSeenOn) - toUtcMidnight(startedOn)) /
      MILLISECONDS_PER_DAY,
  );

  return Math.max(days, 0);
}

export function formatDaysOnAir(days: number, isActive = true): string {
  const count = days === 1 ? "1 dia" : `${days} dias`;

  if (!isActive) return `Parou depois de ${count}`;

  if (days === 0) return "Começou hoje";

  return `No ar há ${count}`;
}

export const MANUAL_SOURCE = "manual";

/** Admin view of where ads came from; "todos" shows everything. */
export const AD_ORIGINS = ["todos", "manuais", "automaticos"] as const;
export type AdOrigin = (typeof AD_ORIGINS)[number];

/** "2026-10-20" → "20/10/2026", or "20/10" without the year. Validates the day first. */
export function formatCalendarDay(
  day: string,
  options: { withYear: boolean },
): string {
  toUtcMidnight(day);
  const [year, month, date] = day.split("-");

  return options.withYear ? `${date}/${month}/${year}` : `${date}/${month}`;
}

/** "Today" for the people using the app, who are in Brazil. */
export function todayInBrazil(now: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
  }).format(now);
}

const LIBRARY_HOSTS = new Set(["facebook.com", "www.facebook.com"]);
const LIBRARY_AD_ID = /^\d{5,30}$/;

/**
 * The ad id from a Meta ad library link (https://www.facebook.com/ads/library/?id=123…).
 * Only the id is kept: the link we show is rebuilt from it, so no stored URL can point elsewhere.
 */
export function parseLibraryAdId(link: string): string | null {
  const url = URL.parse(link.trim());

  if (url == null || url.protocol !== "https:") return null;

  if (!LIBRARY_HOSTS.has(url.hostname)) return null;

  if (!url.pathname.startsWith("/ads/library")) return null;

  const id = url.searchParams.get("id");

  if (id == null || !LIBRARY_AD_ID.test(id)) return null;

  return id;
}

export function libraryUrlFor(libraryAdId: string): string {
  return `https://www.facebook.com/ads/library/?id=${libraryAdId}`;
}

export type ProductLink =
  | { readonly kind: "radar"; readonly productId: string }
  | { readonly kind: "shopee"; readonly url: string };

const RELATIVE_BASE = "https://relative.invalid";
const RADAR_PRODUCT_PATH = /^\/radar\/([a-z0-9-]{1,40})\/?$/;
const SHOPEE_HOSTS = new Set(["shopee.com.br", "www.shopee.com.br"]);

/**
 * The product an ad sells: a link to our own Radar product page, or a Shopee link (kept without
 * query string, which carries tracking).
 */
export function parseProductLink(link: string): ProductLink | null {
  // The base only lets a bare "/radar/<id>" path through; it is never shown or followed.
  const url = URL.parse(link.trim(), RELATIVE_BASE);

  if (url == null) return null;

  const radarMatch = RADAR_PRODUCT_PATH.exec(url.pathname);

  if (radarMatch?.[1] != null)
    return { kind: "radar", productId: radarMatch[1] };

  if (url.protocol !== "https:" || !SHOPEE_HOSTS.has(url.hostname)) return null;

  return { kind: "shopee", url: `${url.origin}${url.pathname}` };
}

import { todayInBrazil } from "@/features/ads/domain/ads";
import { daysBefore } from "@/lib/calendar-day";

/** Longest product search the picker sends; longer names never help find a product. */
export const MAX_PRODUCT_SEARCH_LENGTH = 80;

// A click starts the worker within a second; a video waiting this long lost its worker (a deploy).
const NUDGE_WORKER_AFTER_IN_MS = 30_000;

const MAX_FILE_NAME_LENGTH = 60;
const FALLBACK_FILE_NAME = "video";

const shortDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "Garrafa Térmica 1L" → "garrafa-termica-1l.mp4": a name every phone accepts when saving. */
export function videoFileName(productName: string): string {
  const slug = productName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/^-+|-+$/g, "");

  return `${slug.length === 0 ? FALLBACK_FILE_NAME : slug}.mp4`;
}

/** "hoje", "ontem" or "28/10", by the Brazil calendar. */
export function describeVideoDay(createdAt: Date, now: Date): string {
  const today = todayInBrazil(now);
  const day = todayInBrazil(createdAt);

  if (day === today) return "hoje";

  if (day === daysBefore(today, 1)) return "ontem";

  return shortDayFormatter.format(createdAt);
}

/**
 * Whether the Studio page should start a worker pass itself: the person's video has waited long
 * enough that its worker was lost. Keeps the person from being stuck where no scheduled task runs.
 */
export function shouldNudgeWorker(
  activeVideoCreatedAt: Date | null,
  now: Date,
): boolean {
  if (activeVideoCreatedAt == null) return false;

  return (
    now.getTime() - activeVideoCreatedAt.getTime() >= NUDGE_WORKER_AFTER_IN_MS
  );
}

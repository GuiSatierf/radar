const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** A calendar day (YYYY-MM-DD) shifted back by whole days: ("2026-10-23", 7) → "2026-10-16". */
export function daysBefore(day: string, days: number): string {
  const shifted = new Date(
    new Date(`${day}T00:00:00Z`).getTime() - days * MILLISECONDS_PER_DAY,
  );

  return shifted.toISOString().slice(0, 10);
}

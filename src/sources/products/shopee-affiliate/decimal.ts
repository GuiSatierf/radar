/**
 * The API sends money and rates as decimal strings ("24.30", "0.13"). Converting through float
 * would round wrong ("0.29" × 10000 = 2899.999…), so the digits are shifted as text instead.
 */
const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

export class InvalidDecimalError extends Error {
  constructor(value: string) {
    super(`Not a non-negative decimal: "${value}"`);
    this.name = "InvalidDecimalError";
  }
}

/** Shifts the decimal point right by `places` and rounds half up: ("24.305", 2) → 2431. */
export function shiftDecimal(value: string, places: number): number {
  const match = DECIMAL_PATTERN.exec(value.trim());

  if (match == null) throw new InvalidDecimalError(value);

  const integerPart = match[1] ?? "0";
  const fraction = match[2] ?? "";
  const kept = fraction.slice(0, places).padEnd(places, "0");
  const firstDropped = fraction.charAt(places);
  const shifted = Number.parseInt(`${integerPart}${kept}`, 10);
  const roundsUp = firstDropped.length > 0 && firstDropped >= "5";

  return roundsUp ? shifted + 1 : shifted;
}

/** "24.30" → 2430 cents. */
export function toCents(value: string): number {
  return shiftDecimal(value, 2);
}

/** "0.13" (a fraction) → 1300 basis points. */
export function fractionToBasisPoints(value: string): number {
  return shiftDecimal(value, 4);
}

/** "4.85" → 49 (rating in tenths). */
export function toTenths(value: string): number {
  return shiftDecimal(value, 1);
}

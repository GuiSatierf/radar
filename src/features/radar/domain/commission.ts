/**
 * Shopee pays affiliates its own share (3%, 4% or 8% depending on the affiliate's profile) plus
 * any extra share the shop offers. Rates are basis points (1% = 100) and money is integer cents.
 */
export const COMMISSION_PROFILES = [3, 4, 8] as const;
export type CommissionProfile = (typeof COMMISSION_PROFILES)[number];
export const DEFAULT_COMMISSION_PROFILE: CommissionProfile = 3;

const BASIS_POINTS_PER_PERCENT = 100;
const BASIS_POINTS_TOTAL = 10_000;

export function isCommissionProfile(
  value: unknown,
): value is CommissionProfile {
  return COMMISSION_PROFILES.some((profile) => profile === value);
}

export function shopeeRateBasisPoints(profile: CommissionProfile): number {
  return profile * BASIS_POINTS_PER_PERCENT;
}

export function totalRateBasisPoints(input: {
  profile: CommissionProfile;
  sellerRateBasisPoints: number;
}): number {
  return shopeeRateBasisPoints(input.profile) + input.sellerRateBasisPoints;
}

/** What the affiliate earns per sale, on the lowest price (the honest, conservative number). */
export function earningsPerSaleCents(input: {
  priceCents: number;
  profile: CommissionProfile;
  sellerRateBasisPoints: number;
}): number {
  const rate = totalRateBasisPoints(input);

  return Math.round((input.priceCents * rate) / BASIS_POINTS_TOTAL);
}

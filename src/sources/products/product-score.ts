import {
  DEFAULT_COMMISSION_PROFILE,
  earningsPerSaleCents,
} from "@/features/radar/domain/commission";
import { calculateOpportunityScore } from "@/features/radar/domain/opportunity-score";

/** The score uses the default 3% profile, so every user sees the same ranking. */
export function scoreProduct(fields: {
  affiliateCount: number | null;
  affiliateCountIsMinimum: boolean;
  monthlySales: number;
  priceCents: number;
  sellerRateBasisPoints: number;
}): number {
  return calculateOpportunityScore({
    affiliateCount: fields.affiliateCount,
    affiliateCountIsMinimum: fields.affiliateCountIsMinimum,
    monthlySales: fields.monthlySales,
    earningsPerSaleCents: earningsPerSaleCents({
      priceCents: fields.priceCents,
      profile: DEFAULT_COMMISSION_PROFILE,
      sellerRateBasisPoints: fields.sellerRateBasisPoints,
    }),
  });
}

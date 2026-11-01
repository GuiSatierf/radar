/**
 * Our opportunity score, 0 to 100 (formula approved on 20/10/2026, docs/DECISOES.md):
 * 50% little competition, 30% earnings per sale, 20% demand. Competition and demand use a log
 * scale, so going from 1,000 to 100 affiliates counts as much as going from 100 to 10.
 */
const COMPETITION_WEIGHT = 0.5;
const EARNINGS_WEIGHT = 0.3;
const DEMAND_WEIGHT = 0.2;

/** At or above these values a component is already at its best (or worst) score. */
export const MAX_AFFILIATES_FOR_SCORE = 1_000;
export const MAX_EARNINGS_CENTS_FOR_SCORE = 1_500;
export const MAX_MONTHLY_SALES_FOR_SCORE = 5_000;

const MAX_SCORE = 100;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

function logShare(value: number, max: number): number {
  const safeValue = Math.max(0, value);

  return clampUnit(Math.log10(safeValue + 1) / Math.log10(max + 1));
}

export function competitionComponent(affiliateCount: number): number {
  return 1 - logShare(affiliateCount, MAX_AFFILIATES_FOR_SCORE);
}

export function earningsComponent(earningsCents: number): number {
  return clampUnit(earningsCents / MAX_EARNINGS_CENTS_FOR_SCORE);
}

export function demandComponent(monthlySales: number): number {
  return logShare(monthlySales, MAX_MONTHLY_SALES_FOR_SCORE);
}

const SCORE_BANDS = [
  {
    min: 70,
    // Says only what the score guarantees: a product with zero sales can still reach 80.
    text: "Boa oportunidade: pouca concorrência e bom ganho. Confira as vendas.",
  },
  { min: 40, text: "Oportunidade média: compare com outros produtos." },
  { min: 0, text: "Muita concorrência ou pouco ganho por venda." },
] as const;

const WITHOUT_COMPETITION_TEXT =
  "Nota sem a concorrência, que ainda não contamos. Compare o ganho e as vendas.";

/** One plain sentence for the score, for people who never saw this number before. */
export function describeOpportunity(
  score: number,
  options: { isCompetitionKnown: boolean } = { isCompetitionKnown: true },
): string {
  // The bands talk about competition, which would be a guess without the count.
  if (!options.isCompetitionKnown) return WITHOUT_COMPETITION_TEXT;

  const band = SCORE_BANDS.find((item) => score >= item.min);

  return band?.text ?? SCORE_BANDS[SCORE_BANDS.length - 1].text;
}

/**
 * "10+" only says "at least 10", and a missing count says nothing: the competition is unknown,
 * so it is worth half, not the best.
 */
const UNKNOWN_COMPETITION = 0.5;

export function calculateOpportunityScore(input: {
  affiliateCount: number | null;
  affiliateCountIsMinimum?: boolean;
  earningsPerSaleCents: number;
  monthlySales: number;
}): number {
  const competition =
    input.affiliateCount == null || input.affiliateCountIsMinimum
      ? UNKNOWN_COMPETITION
      : competitionComponent(input.affiliateCount);

  const weighted =
    COMPETITION_WEIGHT * competition +
    EARNINGS_WEIGHT * earningsComponent(input.earningsPerSaleCents) +
    DEMAND_WEIGHT * demandComponent(input.monthlySales);

  return Math.round(weighted * MAX_SCORE);
}

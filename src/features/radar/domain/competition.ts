export type CompetitionLevel = "baixa" | "media" | "alta";
/**
 * What the screen shows: a level, "incerta" when Shopee only told us a minimum ("10+"), or
 * "sem-contagem" while nobody has counted the affiliates yet.
 */
export type CompetitionDisplay = CompetitionLevel | "incerta" | "sem-contagem";

/** Initial limits; the client can adjust them (docs/DECISOES.md). */
export const LOW_COMPETITION_MAX_AFFILIATES = 50;
export const MEDIUM_COMPETITION_MAX_AFFILIATES = 300;

export const COMPETITION_LEVELS: readonly CompetitionLevel[] = [
  "baixa",
  "media",
  "alta",
];

export const COMPETITION_LABEL: Record<CompetitionDisplay, string> = {
  baixa: "Concorrência baixa",
  media: "Concorrência média",
  alta: "Concorrência alta",
  incerta: "Concorrência incerta",
  "sem-contagem": "Concorrência",
};

export function getCompetitionLevel(affiliateCount: number): CompetitionLevel {
  if (affiliateCount <= LOW_COMPETITION_MAX_AFFILIATES) return "baixa";

  if (affiliateCount <= MEDIUM_COMPETITION_MAX_AFFILIATES) return "media";

  return "alta";
}

/**
 * A minimum count ("10+") proves nothing about low or medium competition, since the real number
 * can be much higher. Only "at least 301" is still certainly high.
 */
export function classifyCompetition(input: {
  affiliateCount: number | null;
  affiliateCountIsMinimum: boolean;
}): CompetitionDisplay {
  if (input.affiliateCount == null) return "sem-contagem";

  const level = getCompetitionLevel(input.affiliateCount);

  if (input.affiliateCountIsMinimum && level !== "alta") return "incerta";

  return level;
}

/** Inclusive affiliate-count range of each level, for filtering in the database. */
export const COMPETITION_RANGE: Record<
  CompetitionLevel,
  { min: number; max: number | null; allowsMinimumCounts: boolean }
> = {
  baixa: {
    min: 0,
    max: LOW_COMPETITION_MAX_AFFILIATES,
    allowsMinimumCounts: false,
  },
  media: {
    min: LOW_COMPETITION_MAX_AFFILIATES + 1,
    max: MEDIUM_COMPETITION_MAX_AFFILIATES,
    allowsMinimumCounts: false,
  },
  alta: {
    min: MEDIUM_COMPETITION_MAX_AFFILIATES + 1,
    max: null,
    allowsMinimumCounts: true,
  },
};

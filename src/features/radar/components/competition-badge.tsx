import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  COMPETITION_LABEL,
  type CompetitionDisplay,
  classifyCompetition,
} from "../domain/competition";
import { formatCompact } from "../domain/format";

// The only colors besides the raspberry accent, because they carry meaning (low/medium/high).
// "incerta" stays neutral on purpose: we don't know, so we don't color it.
export const COMPETITION_COLOR: Record<CompetitionDisplay, string> = {
  baixa:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  media: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  alta: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  incerta: "bg-muted text-foreground",
  "sem-contagem": "bg-muted text-foreground",
};

const SHORT_LEVEL: Record<
  Exclude<CompetitionDisplay, "sem-contagem">,
  string
> = {
  baixa: "baixa",
  media: "média",
  alta: "alta",
  incerta: "pode ter mais",
};

interface AffiliateCount {
  affiliateCount: number | null;
  affiliateCountIsMinimum: boolean;
}

const NOT_COUNTED_TEXT = "Ainda não contamos";

export function formatAffiliates(input: AffiliateCount): string {
  if (input.affiliateCount == null) return NOT_COUNTED_TEXT;

  const count = formatCompact(input.affiliateCount);
  const suffix = input.affiliateCount === 1 ? "afiliado" : "afiliados";
  // "10+" means "at least 10"; "0+" would read as nonsense, so zero is always exact.
  const isMinimum = input.affiliateCountIsMinimum && input.affiliateCount > 0;

  return `${count}${isMinimum ? "+" : ""} ${suffix}`;
}

export function CompetitionBadge(
  props: AffiliateCount & { className?: string },
): ReactElement {
  const level = classifyCompetition(props);

  return (
    <span
      title={COMPETITION_LABEL[level]}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        COMPETITION_COLOR[level],
        props.className,
      )}
    >
      {level === "sem-contagem"
        ? "Afiliados: ainda não contamos"
        : `${formatAffiliates(props)} · ${SHORT_LEVEL[level]}`}
    </span>
  );
}

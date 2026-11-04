import type { ReactElement } from "react";
import type { VideoLimitPeriod, VideoQuota } from "../domain/quota";

const PERCENT = 100;

const PERIOD_WORDS: Readonly<
  Record<VideoLimitPeriod, { readonly label: string; readonly now: string }>
> = {
  day: { label: "Vídeos de hoje", now: "hoje" },
  week: { label: "Vídeos da semana", now: "esta semana" },
  month: { label: "Vídeos do mês", now: "este mês" },
};

/** How many videos are left this period, with one sentence saying what that means. */
export function VideoQuotaBox(props: {
  quota: VideoQuota;
  period: VideoLimitPeriod;
  renewal: string;
}): ReactElement {
  const { quota } = props;
  const words = PERIOD_WORDS[props.period];

  if (quota.limit === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-sm">
        Os vídeos não estão liberados para a sua conta.
      </section>
    );
  }

  const leftPercent = Math.round((quota.remaining / quota.limit) * PERCENT);

  return (
    <section
      aria-label={words.label}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
    >
      <p>
        <span className="text-lg font-semibold">
          {quota.remaining} de {quota.limit}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          vídeos livres {words.now}
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${leftPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Cada vídeo gasta 1. A conta volta para {quota.limit} {props.renewal}.
      </p>
    </section>
  );
}

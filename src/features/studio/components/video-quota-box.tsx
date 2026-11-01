import type { ReactElement } from "react";
import type { VideoQuota } from "../domain/quota";

const PERCENT = 100;

/** How many videos are left this month, with one sentence saying what that means. */
export function VideoQuotaBox(props: {
  quota: VideoQuota;
  renewal: string;
}): ReactElement {
  const { quota } = props;

  if (quota.limit === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 text-sm">
        Seu plano não inclui vídeos.
      </section>
    );
  }

  const leftPercent = Math.round((quota.remaining / quota.limit) * PERCENT);

  return (
    <section
      aria-label="Vídeos do mês"
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
    >
      <p>
        <span className="text-lg font-semibold">
          {quota.remaining} de {quota.limit}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          vídeos livres este mês
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${leftPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Cada vídeo gasta 1. A conta volta para {quota.limit} em {props.renewal}.
      </p>
    </section>
  );
}

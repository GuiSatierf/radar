import type { VideoLimitPeriod, VideoQuota } from "./quota";

export const BUSY_MESSAGE =
  "Espere o vídeo que está sendo feito ficar pronto para fazer o próximo.";

/** "deste mês": the period as it ends a sentence about the videos used. */
export const PERIOD_OF_USE: Readonly<Record<VideoLimitPeriod, string>> = {
  day: "de hoje",
  week: "desta semana",
  month: "deste mês",
};

/** Why the limit stops a new video, or null when there are videos left. */
export function describeQuotaBlock(
  quota: VideoQuota,
  period: VideoLimitPeriod,
  renewal: string,
): string | null {
  if (quota.limit === 0)
    return "Os vídeos não estão liberados para a sua conta.";

  if (quota.remaining > 0) return null;

  return `Você usou os ${quota.limit} vídeos ${PERIOD_OF_USE[period]}. Novos vídeos liberam ${renewal}, e os que você já fez continuam aqui.`;
}

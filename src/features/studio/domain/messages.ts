import type { VideoQuota } from "./quota";

export const BUSY_MESSAGE =
  "Espere o vídeo que está sendo feito ficar pronto para fazer o próximo.";

/** Why the monthly limit stops a new video, or null when there are videos left. */
export function describeQuotaBlock(
  quota: VideoQuota,
  renewal: string,
): string | null {
  if (quota.limit === 0) return "Seu plano não inclui vídeos.";

  if (quota.remaining > 0) return null;

  return `Você usou os ${quota.limit} vídeos deste mês. Novos vídeos liberam em ${renewal}, e os que você já fez continuam aqui.`;
}

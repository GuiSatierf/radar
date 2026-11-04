import type { HotmartIdKind } from "@/features/billing/hotmart/plan-mapping";

/** How the admin page names each kind of Hotmart code. */
export const HOTMART_KIND_LABEL: Readonly<Record<HotmartIdKind, string>> = {
  plano: "Assinatura",
  produto: "Produto",
};

/** Hotmart's event names, in words the admin understands. Unknown ones show as they came. */
const EVENT_LABELS: Readonly<Record<string, string>> = {
  PURCHASE_APPROVED: "Compra aprovada",
  PURCHASE_COMPLETE: "Compra concluída",
  PURCHASE_REFUNDED: "Reembolso",
  PURCHASE_CHARGEBACK: "Contestação no cartão",
  PURCHASE_CANCELED: "Compra cancelada",
  PURCHASE_EXPIRED: "Compra expirada",
  SUBSCRIPTION_CANCELLATION: "Assinatura cancelada",
  SWITCH_PLAN: "Troca de plano na Hotmart",
};

// Keys are the details the webhook stores (src/features/billing/hotmart).
const APPLIED_LABELS: Readonly<Record<string, string>> = {
  grant: "Acesso liberado",
  end: "Fim do acesso marcado",
};

const MISSING_DATA = "Aviso sem produto ou e-mail";

const IGNORED_LABELS: Readonly<Record<string, string>> = {
  "product not mapped to a plan": "Produto que não libera acesso",
  "purchase without product or buyer e-mail": MISSING_DATA,
  "cancellation without product or e-mail": MISSING_DATA,
  "plan switch without product or e-mail": MISSING_DATA,
  "event not used": "Tipo de aviso que não usamos",
};

export function describeHotmartEvent(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

export function describeHotmartOutcome(input: {
  outcome: string;
  detail: string | null;
}): { readonly applied: boolean; readonly label: string } {
  const detail = input.detail ?? "";

  if (input.outcome === "applied")
    return { applied: true, label: APPLIED_LABELS[detail] ?? "Aplicado" };

  // Plans are not unlocked automatically yet: the event was only kept.
  if (input.outcome === "received")
    return { applied: false, label: "Registrado" };

  return { applied: false, label: IGNORED_LABELS[detail] ?? "Ignorado" };
}

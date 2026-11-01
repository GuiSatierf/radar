import { z } from "zod";
import type { PlanId } from "@/features/plans/plans";
import { type HotmartPlanMapping, resolveHotmartPlan } from "./plan-mapping";

/**
 * Hotmart webhook 2.0.0 (developers.hotmart.com, "Eventos de pedido", "Evento de cancelamento de
 * assinatura" and "Evento de troca de plano"). Only the fields we use are read; everything else
 * in the body is ignored.
 */
export type AccessChange =
  | {
      readonly kind: "grant";
      readonly email: string;
      readonly productId: string;
      readonly plan: PlanId;
      /**
       * True only for a payment (PURCHASE_APPROVED): it renews access and clears a pending end.
       * A completed purchase or a plan switch keeps any end a cancellation already set.
       */
      readonly renewsAccess: boolean;
      readonly at: Date;
    }
  | {
      readonly kind: "end";
      readonly email: string;
      readonly productId: string;
      readonly endsAt: Date;
      readonly at: Date;
    }
  | { readonly kind: "ignore"; readonly reason: string };

const PAYMENT_EVENT = "PURCHASE_APPROVED";
const GRANT_EVENTS = new Set([PAYMENT_EVENT, "PURCHASE_COMPLETE"]);
/** The money went back or never arrived: access ends now. */
const END_NOW_EVENTS = new Set([
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_CANCELED",
  "PURCHASE_EXPIRED",
]);

const id = z.union([z.string(), z.number()]).transform(String);
const email = z.string().trim().toLowerCase().pipe(z.email());

export const hotmartEnvelopeSchema = z.object({
  id: z.string().min(1).max(100),
  creation_date: z.number().int().positive(),
  event: z.string().min(1).max(60),
  data: z.unknown(),
});

export type HotmartEnvelope = z.infer<typeof hotmartEnvelopeSchema>;

const purchaseSchema = z.object({
  product: z.object({ id }),
  buyer: z.object({ email }),
  subscription: z.object({ plan: z.object({ id }).nullish() }).nullish(),
});

const cancellationSchema = z.object({
  product: z.object({ id }),
  subscriber: z.object({ email }),
  date_next_charge: z.number().int().positive().nullish(),
});

const switchPlanSchema = z.object({
  subscription: z.object({
    product: z.object({ id }),
    user: z.object({ email }),
  }),
  plans: z.array(z.object({ id, current: z.boolean() })),
});

function ignore(reason: string): AccessChange {
  return { kind: "ignore", reason };
}

function grantOrIgnore(input: {
  mapping: HotmartPlanMapping;
  email: string;
  productId: string;
  planId: string | null;
  renewsAccess: boolean;
  at: Date;
}): AccessChange {
  const plan = resolveHotmartPlan(input.mapping, input);

  if (plan == null) return ignore("product not mapped to a plan");

  return {
    kind: "grant",
    email: input.email,
    productId: input.productId,
    plan,
    renewsAccess: input.renewsAccess,
    at: input.at,
  };
}

function fromPurchase(
  envelope: HotmartEnvelope,
  mapping: HotmartPlanMapping,
  at: Date,
): AccessChange {
  const data = purchaseSchema.safeParse(envelope.data);

  if (!data.success) return ignore("purchase without product or buyer e-mail");

  const productId = data.data.product.id;
  const buyerEmail = data.data.buyer.email;

  if (END_NOW_EVENTS.has(envelope.event)) {
    return { kind: "end", email: buyerEmail, productId, endsAt: at, at };
  }

  return grantOrIgnore({
    mapping,
    email: buyerEmail,
    productId,
    planId: data.data.subscription?.plan?.id ?? null,
    renewsAccess: envelope.event === PAYMENT_EVENT,
    at,
  });
}

/** Access goes on until the end of the period already paid, as Hotmart recommends. */
function fromCancellation(envelope: HotmartEnvelope, at: Date): AccessChange {
  const data = cancellationSchema.safeParse(envelope.data);

  if (!data.success) return ignore("cancellation without product or e-mail");

  const paidUntil = data.data.date_next_charge;
  const endsAt =
    paidUntil != null && paidUntil > at.getTime() ? new Date(paidUntil) : at;

  return {
    kind: "end",
    email: data.data.subscriber.email,
    productId: data.data.product.id,
    endsAt,
    at,
  };
}

function fromSwitchPlan(
  envelope: HotmartEnvelope,
  mapping: HotmartPlanMapping,
  at: Date,
): AccessChange {
  const data = switchPlanSchema.safeParse(envelope.data);

  if (!data.success) return ignore("plan switch without product or e-mail");

  const current = data.data.plans.find((plan) => plan.current);

  return grantOrIgnore({
    mapping,
    email: data.data.subscription.user.email,
    productId: data.data.subscription.product.id,
    planId: current?.id ?? null,
    renewsAccess: false,
    at,
  });
}

/** What one Hotmart event means for access; no database here, so every case is unit-tested. */
export function interpretHotmartEvent(
  envelope: HotmartEnvelope,
  mapping: HotmartPlanMapping,
): AccessChange {
  const at = new Date(envelope.creation_date);

  if (GRANT_EVENTS.has(envelope.event) || END_NOW_EVENTS.has(envelope.event)) {
    return fromPurchase(envelope, mapping, at);
  }

  if (envelope.event === "SUBSCRIPTION_CANCELLATION") {
    return fromCancellation(envelope, at);
  }

  if (envelope.event === "SWITCH_PLAN") {
    return fromSwitchPlan(envelope, mapping, at);
  }

  return ignore("event not used");
}

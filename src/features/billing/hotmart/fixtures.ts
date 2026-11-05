import type { HotmartPlanRow } from "./plan-mapping";

/**
 * Hotmart webhook bodies in the shape of the official 2.0.0 examples (trimmed to what matters),
 * for the unit and integration tests.
 */
export const PRODUCT_ID = 3526906;
export const SUBSCRIPTION_PLAN_ID = 460805;
export const OTHER_SUBSCRIPTION_PLAN_ID = 707635;
export const TEST_PLAN_ROWS: readonly HotmartPlanRow[] = [
  { kind: "plano", hotmartId: String(SUBSCRIPTION_PLAN_ID), plan: "full" },
  {
    kind: "plano",
    hotmartId: String(OTHER_SUBSCRIPTION_PLAN_ID),
    plan: "full",
  },
  { kind: "produto", hotmartId: "999", plan: "full" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function purchaseEvent(input: {
  id: string;
  event: string;
  email: string;
  at: number;
  planId?: number;
  productId?: number;
}) {
  return {
    id: input.id,
    creation_date: input.at,
    event: input.event,
    version: "2.0.0",
    data: {
      product: { id: input.productId ?? PRODUCT_ID, name: "Assinatura" },
      buyer: { email: input.email, name: "Maria Souza" },
      purchase: { status: "APPROVED", transaction: "HP02316330308193" },
      subscription: {
        status: "ACTIVE",
        plan: { id: input.planId ?? SUBSCRIPTION_PLAN_ID, name: "Mensal" },
        subscriber: { code: "QO4THU04" },
      },
    },
  };
}

export function cancellationEvent(input: {
  id: string;
  email: string;
  at: number;
  paidDays: number;
}) {
  return {
    id: input.id,
    creation_date: input.at,
    event: "SUBSCRIPTION_CANCELLATION",
    version: "2.0.0",
    data: {
      date_next_charge: input.at + input.paidDays * DAY_MS,
      product: { name: "Assinatura", id: PRODUCT_ID },
      subscriber: { code: "QO4THU04", name: "Maria", email: input.email },
      subscription: {
        id: 471681,
        plan: { name: "Mensal", id: SUBSCRIPTION_PLAN_ID },
      },
      cancellation_date: input.at,
    },
  };
}

export function switchPlanEvent(input: {
  id: string;
  email: string;
  at: number;
  toPlanId: number;
}) {
  return {
    id: input.id,
    creation_date: input.at,
    event: "SWITCH_PLAN",
    version: "2.0.0",
    data: {
      switch_plan_date: input.at,
      subscription: {
        subscriber_code: "AT3IV3RX",
        status: "ACTIVE",
        product: { id: PRODUCT_ID, name: "Assinatura" },
        user: { email: input.email },
      },
      plans: [
        { id: input.toPlanId, name: "Novo", current: true },
        { id: SUBSCRIPTION_PLAN_ID, name: "Mensal", current: false },
      ],
    },
  };
}

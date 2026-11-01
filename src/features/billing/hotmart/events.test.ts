import { describe, expect, it } from "vitest";
import { hotmartEnvelopeSchema, interpretHotmartEvent } from "./events";
import {
  cancellationEvent,
  PRO_PLAN_ID,
  PRODUCT_ID,
  purchaseEvent,
  switchPlanEvent,
  TEST_PLAN_ROWS,
} from "./fixtures";
import { buildHotmartPlanMapping, resolveHotmartPlan } from "./plan-mapping";

const MAPPING = buildHotmartPlanMapping(TEST_PLAN_ROWS);
const AT = Date.UTC(2026, 9, 23, 12);

function interpret(body: unknown) {
  return interpretHotmartEvent(hotmartEnvelopeSchema.parse(body), MAPPING);
}

describe("buildHotmartPlanMapping", () => {
  it("deve ler assinatura e produto, e a assinatura vence o produto", () => {
    expect(
      resolveHotmartPlan(MAPPING, { planId: "707635", productId: "999" }),
    ).toBe("pro");
    expect(resolveHotmartPlan(MAPPING, { planId: "1", productId: "999" })).toBe(
      "completo",
    );
    expect(
      resolveHotmartPlan(MAPPING, { planId: null, productId: "1" }),
    ).toBeNull();
  });

  it("deve ficar vazio sem nenhuma linha", () => {
    expect(buildHotmartPlanMapping([]).size).toBe(0);
  });
});

describe("interpretHotmartEvent", () => {
  it("deve liberar o plano da compra aprovada, com o e-mail normalizado", () => {
    const change = interpret(
      purchaseEvent({
        id: "1",
        event: "PURCHASE_APPROVED",
        email: " Maria@Email.COM ",
        at: AT,
      }),
    );

    expect(change).toEqual({
      kind: "grant",
      email: "maria@email.com",
      productId: String(PRODUCT_ID),
      plan: "radar",
      renewsAccess: true,
      at: new Date(AT),
    });
  });

  it("não deve renovar o acesso com compra completa nem com troca de plano", () => {
    const complete = interpret(
      purchaseEvent({
        id: "c",
        event: "PURCHASE_COMPLETE",
        email: "a@b.com",
        at: AT,
      }),
    );
    const switched = interpret(
      switchPlanEvent({
        id: "s",
        email: "a@b.com",
        at: AT,
        toPlanId: PRO_PLAN_ID,
      }),
    );

    expect(complete).toMatchObject({ kind: "grant", renewsAccess: false });
    expect(switched).toMatchObject({ kind: "grant", renewsAccess: false });
  });

  it("deve encerrar na hora com reembolso, chargeback, cancelamento ou vencimento", () => {
    for (const event of [
      "PURCHASE_REFUNDED",
      "PURCHASE_CHARGEBACK",
      "PURCHASE_CANCELED",
      "PURCHASE_EXPIRED",
    ]) {
      const change = interpret(
        purchaseEvent({ id: event, event, email: "a@b.com", at: AT }),
      );

      expect(change).toMatchObject({ kind: "end", endsAt: new Date(AT) });
    }
  });

  it("deve manter o acesso até o fim do período pago quando a assinatura é cancelada", () => {
    const change = interpret(
      cancellationEvent({ id: "c", email: "a@b.com", at: AT, paidDays: 17 }),
    );

    expect(change).toMatchObject({
      kind: "end",
      endsAt: new Date(AT + 17 * 24 * 60 * 60 * 1000),
    });
  });

  it("deve usar o plano atual na troca de plano", () => {
    const change = interpret(
      switchPlanEvent({
        id: "s",
        email: "a@b.com",
        at: AT,
        toPlanId: PRO_PLAN_ID,
      }),
    );

    expect(change).toMatchObject({ kind: "grant", plan: "pro" });
  });

  it("deve ignorar produto fora do mapa, evento sem uso e corpo sem e-mail", () => {
    expect(
      interpret(
        purchaseEvent({
          id: "x",
          event: "PURCHASE_APPROVED",
          email: "a@b.com",
          at: AT,
          planId: 1,
          productId: 1,
        }),
      ),
    ).toMatchObject({ kind: "ignore" });
    expect(
      interpret(
        purchaseEvent({
          id: "y",
          event: "PURCHASE_DELAYED",
          email: "a@b.com",
          at: AT,
        }),
      ),
    ).toMatchObject({ kind: "ignore", reason: "event not used" });
    expect(
      interpret({
        id: "z",
        creation_date: AT,
        event: "PURCHASE_APPROVED",
        data: { product: { id: 1 } },
      }),
    ).toMatchObject({ kind: "ignore" });
  });
});

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/db/client";
import { hotmartAccess, hotmartEvent, user } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { capturingSender, confirmEmail } from "@/lib/auth.fixtures";
import { applyEndedAccess } from "../access";
import {
  cancellationEvent,
  PRO_PLAN_ID,
  purchaseEvent,
  switchPlanEvent,
  TEST_PLAN_ROWS,
} from "./fixtures";
import { buildHotmartPlanMapping } from "./plan-mapping";
import { hashHottok } from "./settings";
import { HOTTOK_HEADER, handleHotmartWebhook } from "./webhook";

const { db, pool } = createDatabase(process.env.TEST_DATABASE_URL ?? "");
const sender = capturingSender();
const auth = createAuth(
  db,
  {
    APP_NAME: "Teste",
    BETTER_AUTH_SECRET: "integration-test-secret-integration-test",
    BETTER_AUTH_URL: "http://localhost:3210",
    CLIENT_IP_HEADER: "x-real-ip",
  },
  { emailSender: sender },
);
const HOTTOK = "hottok-de-teste-123";
const MAPPING = buildHotmartPlanMapping(TEST_PLAN_ROWS);
const EMAIL = "maria@teste.test";
const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 23, 12);

async function send(
  body: unknown,
  options: { now?: number; hottok?: string; unlocksPlans?: boolean } = {},
): Promise<Response> {
  const request = new Request("http://localhost/api/webhooks/hotmart", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [HOTTOK_HEADER]: options.hottok ?? HOTTOK,
    },
    body: JSON.stringify(body),
  });

  return handleHotmartWebhook({
    db,
    request,
    hottokHash: hashHottok(HOTTOK),
    loadMapping: async () => MAPPING,
    unlocksPlans: options.unlocksPlans ?? true,
    now: new Date(options.now ?? T0),
  });
}

async function signUpWithoutConfirming(email = EMAIL): Promise<void> {
  await auth.api.signUpEmail({
    body: { name: "Maria Souza", email, password: "senha-forte-123" },
  });
}

/** An account whose owner already opened the confirmation link. */
async function signUp(email = EMAIL): Promise<void> {
  await signUpWithoutConfirming(email);
  await confirmEmail(auth, sender.sent, email);
}

/** The real database, except that the second account-plan write inside a transaction fails. */
function failingOnSecondAccountWrite(): typeof db {
  let accountWrites = 0;
  const failing = <T extends object>(tx: T): T =>
    new Proxy(tx, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);

        if (property !== "update") return value;

        const update = value as (table: unknown) => unknown;

        return (table: unknown) => {
          if (table === user) accountWrites += 1;
          if (accountWrites === 2)
            throw new Error("simulated database failure");

          return update.call(target, table);
        };
      },
    });

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction")
        return Reflect.get(target, property, receiver);

      return (run: (tx: unknown) => Promise<unknown>) =>
        target.transaction((tx) => run(failing(tx)));
    },
  });
}

async function planOf(email: string): Promise<string | undefined> {
  const [row] = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.email, email));

  return row?.plan;
}

beforeEach(async () => {
  await db.execute(
    sql`truncate table "user", ${hotmartAccess}, ${hotmartEvent} cascade`,
  );
});

afterAll(async () => {
  await pool.end();
});

describe("webhook da Hotmart", () => {
  it("deve liberar o plano de quem já tem conta quando a compra é aprovada", async () => {
    await signUp();

    const response = await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    expect(response.status).toBe(200);
    expect(await planOf(EMAIL)).toBe("radar");
  });

  it("deve dar o plano ao confirmar o e-mail para quem comprou antes de criar a conta", async () => {
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );
    await signUpWithoutConfirming();
    expect(await planOf(EMAIL)).toBe("none");

    await confirmEmail(auth, sender.sent, EMAIL);

    expect(await planOf(EMAIL)).toBe("radar");
  });

  it("não deve dar a compra de outra pessoa a quem só criou a conta com o e-mail dela", async () => {
    await signUpWithoutConfirming();

    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve tirar o plano na hora com reembolso", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    await send(
      purchaseEvent({
        id: "e2",
        event: "PURCHASE_REFUNDED",
        email: EMAIL,
        at: T0 + 1000,
      }),
      { now: T0 + 2000 },
    );

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve manter o acesso até o fim do período pago e tirar depois, uma vez só", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    await send(
      cancellationEvent({ id: "e2", email: EMAIL, at: T0, paidDays: 10 }),
    );
    expect(await planOf(EMAIL)).toBe("radar");

    expect(await applyEndedAccess(db, new Date(T0 + 5 * DAY_MS))).toBe(0);
    expect(await planOf(EMAIL)).toBe("radar");

    expect(await applyEndedAccess(db, new Date(T0 + 11 * DAY_MS))).toBe(1);
    expect(await planOf(EMAIL)).toBe("none");

    // The admin gives a plan by hand afterwards: the daily task must not undo it.
    await db.update(user).set({ plan: "pro" }).where(eq(user.email, EMAIL));
    expect(await applyEndedAccess(db, new Date(T0 + 12 * DAY_MS))).toBe(0);
    expect(await planOf(EMAIL)).toBe("pro");
  });

  it("não deve deixar a compra completa, depois do cancelamento, apagar o fim do acesso", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );
    await send(
      cancellationEvent({
        id: "e2",
        email: EMAIL,
        at: T0 + DAY_MS,
        paidDays: 29,
      }),
    );

    await send(
      purchaseEvent({
        id: "e3",
        event: "PURCHASE_COMPLETE",
        email: EMAIL,
        at: T0 + 7 * DAY_MS,
      }),
      { now: T0 + 7 * DAY_MS },
    );

    expect(await planOf(EMAIL)).toBe("radar");
    expect(await applyEndedAccess(db, new Date(T0 + 60 * DAY_MS))).toBe(1);
    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve mudar o plano na troca depois do cancelamento, mas manter o fim", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );
    await send(
      cancellationEvent({
        id: "e2",
        email: EMAIL,
        at: T0 + DAY_MS,
        paidDays: 29,
      }),
    );

    await send(
      switchPlanEvent({
        id: "e3",
        email: EMAIL,
        at: T0 + 2 * DAY_MS,
        toPlanId: PRO_PLAN_ID,
      }),
      { now: T0 + 2 * DAY_MS },
    );

    expect(await planOf(EMAIL)).toBe("pro");
    expect(await applyEndedAccess(db, new Date(T0 + 60 * DAY_MS))).toBe(1);
    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve renovar o acesso quando um novo pagamento chega depois do cancelamento", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );
    await send(
      cancellationEvent({
        id: "e2",
        email: EMAIL,
        at: T0 + DAY_MS,
        paidDays: 29,
      }),
    );

    await send(
      purchaseEvent({
        id: "e3",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0 + 20 * DAY_MS,
      }),
      { now: T0 + 20 * DAY_MS },
    );

    expect(await applyEndedAccess(db, new Date(T0 + 60 * DAY_MS))).toBe(0);
    expect(await planOf(EMAIL)).toBe("radar");
  });

  it("deve refazer no dia seguinte o fim de acesso que falhou no meio da tarefa", async () => {
    const OTHER = "joana@teste.test";
    for (const [index, email] of [EMAIL, OTHER].entries()) {
      await signUp(email);
      await send(
        purchaseEvent({
          id: `compra-${index}`,
          event: "PURCHASE_APPROVED",
          email,
          at: T0,
        }),
      );
      await send(
        cancellationEvent({
          id: `cancela-${index}`,
          email,
          at: T0,
          paidDays: 10,
        }),
      );
    }
    const afterPaidPeriod = new Date(T0 + 11 * DAY_MS);

    await expect(
      applyEndedAccess(failingOnSecondAccountWrite(), afterPaidPeriod),
    ).rejects.toThrow("simulated database failure");
    const plans = [await planOf(EMAIL), await planOf(OTHER)];
    expect(plans.toSorted()).toEqual(["none", "radar"]);

    expect(await applyEndedAccess(db, afterPaidPeriod)).toBe(1);
    expect([await planOf(EMAIL), await planOf(OTHER)]).toEqual([
      "none",
      "none",
    ]);
  });

  it("deve trocar o plano quando a pessoa muda de plano na Hotmart", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    await send(
      switchPlanEvent({
        id: "e2",
        email: EMAIL,
        at: T0 + 1000,
        toPlanId: PRO_PLAN_ID,
      }),
    );

    expect(await planOf(EMAIL)).toBe("pro");
  });

  it("deve aplicar o mesmo evento uma vez só, mesmo que a Hotmart mande de novo", async () => {
    await signUp();
    const approved = purchaseEvent({
      id: "e1",
      event: "PURCHASE_APPROVED",
      email: EMAIL,
      at: T0,
    });
    await send(approved);
    await send(
      purchaseEvent({
        id: "e2",
        event: "PURCHASE_REFUNDED",
        email: EMAIL,
        at: T0 + 1000,
      }),
    );

    const again = await send(approved);

    expect(await again.json()).toEqual({ status: "duplicate" });
    expect(await planOf(EMAIL)).toBe("none");
  });

  it("não deve deixar a aprovação, chegando depois do reembolso, liberar o acesso de novo", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e2",
        event: "PURCHASE_REFUNDED",
        email: EMAIL,
        at: T0 + 1000,
      }),
    );

    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve tirar o acesso do reembolso mesmo com o relógio da Hotmart um pouco adiantado", async () => {
    await signUp();
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
    );

    await send(
      purchaseEvent({
        id: "e2",
        event: "PURCHASE_REFUNDED",
        email: EMAIL,
        at: T0 + 5000,
      }),
      { now: T0 },
    );

    expect(await planOf(EMAIL)).toBe("none");
  });

  it("deve recusar quem não manda o código certo da Hotmart, sem aplicar nada", async () => {
    await signUp();

    const response = await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
      { hottok: "codigo-errado-123" },
    );

    expect(response.status).toBe(401);
    expect(await planOf(EMAIL)).toBe("none");
    expect(await db.select().from(hotmartEvent)).toHaveLength(0);
  });

  it("deve guardar o evento ignorado com o motivo, sem dado pessoal", async () => {
    const response = await send({
      id: "e9",
      creation_date: T0,
      event: "PURCHASE_BILLET_PRINTED",
      data: {},
    });
    const [stored] = await db.select().from(hotmartEvent);

    expect(await response.json()).toEqual({ status: "ignored" });
    expect(stored).toMatchObject({
      outcome: "ignored",
      detail: "event not used",
    });
  });

  it("deve só registrar o aviso, sem liberar plano, enquanto a liberação está desligada", async () => {
    await signUp();

    const response = await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
      { unlocksPlans: false },
    );
    const [stored] = await db.select().from(hotmartEvent);

    expect(await response.json()).toEqual({ status: "received" });
    expect(stored).toMatchObject({ outcome: "received", detail: null });
    expect(await planOf(EMAIL)).toBe("none");
    expect(await db.select().from(hotmartAccess)).toHaveLength(0);
  });

  it("deve manter o motivo do aviso ignorado mesmo com a liberação desligada", async () => {
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
        planId: 1,
        productId: 1,
      }),
      { unlocksPlans: false },
    );
    const [stored] = await db.select().from(hotmartEvent);

    expect(stored).toMatchObject({
      outcome: "ignored",
      detail: "product not mapped to a plan",
    });
  });

  it("não deve dar o plano no cadastro por um aviso que só foi registrado", async () => {
    await send(
      purchaseEvent({
        id: "e1",
        event: "PURCHASE_APPROVED",
        email: EMAIL,
        at: T0,
      }),
      { unlocksPlans: false },
    );

    await signUp();

    expect(await planOf(EMAIL)).toBe("none");
  });
});

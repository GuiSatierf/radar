import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import {
  AddPlanForm,
  HottokForm,
  RemovePlanButton,
  WebhookAddress,
} from "@/features/admin/components/hotmart-setup";
import {
  describeHotmartEvent,
  describeHotmartOutcome,
  HOTMART_KIND_LABEL,
} from "@/features/admin/hotmart-labels";
import {
  HOTMART_EVENTS_SHOWN,
  type HotmartEventRow,
  listRecentHotmartEvents,
} from "@/features/admin/queries";
import type { HotmartPlanRow } from "@/features/billing/hotmart/plan-mapping";
import {
  getHottokHash,
  HOTMART_UNLOCKS_PLANS,
  listHotmartPlanRows,
} from "@/features/billing/hotmart/settings";
import { PLANS } from "@/features/plans/plans";
import { formatUpdatedAt } from "@/features/radar/domain/format";
import { getServerEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Hotmart" };

const WEBHOOK_PATH = "/api/webhooks/hotmart";

function SetupStep(props: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <h3 className="font-medium">{props.title}</h3>
      {props.children}
      {props.hint != null && (
        <p className="text-sm text-muted-foreground">{props.hint}</p>
      )}
    </section>
  );
}

function PlanRows(props: { rows: HotmartPlanRow[] }): ReactElement {
  if (props.rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum produto ainda. Sem isso, as compras chegam mas não liberam plano.
      </p>
    );

  return (
    <ul className="flex flex-col divide-y divide-border">
      {props.rows.map((row) => (
        <li
          key={`${row.kind}:${row.hotmartId}`}
          className="flex items-center gap-3 py-1 text-sm"
        >
          <span className="w-24 text-muted-foreground">
            {HOTMART_KIND_LABEL[row.kind]}
          </span>
          <span className="flex-1 font-mono">{row.hotmartId}</span>
          <span className="font-medium">{PLANS[row.plan].label}</span>
          <RemovePlanButton kind={row.kind} hotmartId={row.hotmartId} />
        </li>
      ))}
    </ul>
  );
}

function EventItem(props: { row: HotmartEventRow }): ReactElement {
  const { row } = props;
  const outcome = describeHotmartOutcome(row);

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{describeHotmartEvent(row.event)}</p>
        <p className="text-xs text-muted-foreground">
          {formatUpdatedAt(row.receivedAt)}
        </p>
      </div>
      <Badge variant={outcome.applied ? "secondary" : "outline"}>
        {outcome.label}
      </Badge>
    </li>
  );
}

function describeHottok(savedAt: Date | null): string {
  const kept =
    "Depois de salvo, o código não aparece de novo, nem aqui: só dá para trocar.";

  if (savedAt == null) return `Ainda não salvo. ${kept}`;

  return `Salvo em ${formatUpdatedAt(savedAt)}. ${kept}`;
}

export default async function AdminHotmartPage(): Promise<ReactElement> {
  await requireAdmin();
  const db = getDatabase();
  const webhookUrl = new URL(
    WEBHOOK_PATH,
    getServerEnv().BETTER_AUTH_URL,
  ).toString();

  const [events, hottok, planRows] = await Promise.all([
    listRecentHotmartEvents(db),
    getHottokHash(db),
    listHotmartPlanRows(db),
  ]);
  const lastEvent = events[0];

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="hotmart" />

      <section className="flex flex-col gap-3" aria-label="Ligar a Hotmart">
        <h2 className="text-lg font-semibold">Ligar a Hotmart</h2>

        {HOTMART_UNLOCKS_PLANS === false && (
          <p
            role="note"
            className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            Os avisos da Hotmart já podem chegar e ficam registrados. Os planos
            ainda não são liberados sozinhos: falta a confirmação de e-mail no
            cadastro. Quem comprar antes disso não ganha o plano depois, nem
            quando a liberação ligar: libere à mão em Contas.
          </p>
        )}

        <SetupStep
          title="1 · Endereço para colar na Hotmart"
          hint="Na Hotmart: Ferramentas → Webhook → Cadastrar Webhook, versão 2.0.0."
        >
          <WebhookAddress url={webhookUrl} />
        </SetupStep>

        <SetupStep
          title="2 · Código secreto da Hotmart"
          hint={describeHottok(hottok?.updatedAt ?? null)}
        >
          <HottokForm />
        </SetupStep>

        <SetupStep
          title="3 · Qual produto libera qual plano"
          hint="Quando uma compra tem os dois, vale a linha da assinatura."
        >
          <PlanRows rows={planRows} />
          <AddPlanForm />
        </SetupStep>
      </section>

      <section className="flex flex-col gap-3" aria-label="Avisos da Hotmart">
        <div>
          <h2 className="text-lg font-semibold">Avisos da Hotmart</h2>
          <p className="text-sm text-muted-foreground">
            Cada compra, cancelamento ou reembolso chega aqui como um aviso. Os{" "}
            {HOTMART_EVENTS_SHOWN} mais recentes aparecem primeiro. Por
            privacidade, o aviso não mostra quem comprou.
          </p>
          {lastEvent != null && (
            <p className="mt-1 text-sm">
              Último aviso: {formatUpdatedAt(lastEvent.receivedAt)}
            </p>
          )}
        </div>

        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum aviso chegou ainda. Depois dos passos acima, use "Enviar
            teste" na Hotmart para ver o primeiro aqui.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {events.map((row) => (
            <EventItem key={row.id} row={row} />
          ))}
        </ul>
      </section>
    </div>
  );
}

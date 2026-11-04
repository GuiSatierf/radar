import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import {
  AddPlanForm,
  HottokForm,
  RemovePlanButton,
  UnlockSwitch,
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
  getHotmartSettings,
  listHotmartPlanRows,
} from "@/features/billing/hotmart/settings";
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
        Nenhum produto ainda. Sem isso, as compras chegam mas não liberam
        acesso.
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

function describeUnlocking(unlocksPlansAt: Date | null): string {
  if (unlocksPlansAt == null)
    return "Os avisos ficam registrados, mas ninguém ganha acesso sozinho. Libere à mão em Contas. Ligar não vale para quem comprou antes.";

  return "Quem compra e confirma o e-mail ganha o acesso na hora. Cancelamento e reembolso tiram o acesso.";
}

export default async function AdminHotmartPage(): Promise<ReactElement> {
  await requireAdmin();
  const db = getDatabase();
  const webhookUrl = new URL(
    WEBHOOK_PATH,
    getServerEnv().BETTER_AUTH_URL,
  ).toString();

  const [events, settings, planRows] = await Promise.all([
    listRecentHotmartEvents(db),
    getHotmartSettings(db),
    listHotmartPlanRows(db),
  ]);
  const lastEvent = events[0];
  const unlocksPlansAt = settings?.unlocksPlansAt ?? null;

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="hotmart" />

      <section className="flex flex-col gap-3" aria-label="Ligar a Hotmart">
        <h2 className="text-lg font-semibold">Ligar a Hotmart</h2>

        <SetupStep
          title="1 · Endereço para colar na Hotmart"
          hint="Na Hotmart: Ferramentas → Webhook → Cadastrar Webhook, versão 2.0.0."
        >
          <WebhookAddress url={webhookUrl} />
        </SetupStep>

        <SetupStep
          title="2 · Código secreto da Hotmart"
          hint={describeHottok(settings?.updatedAt ?? null)}
        >
          <HottokForm />
        </SetupStep>

        <SetupStep
          title="3 · Quais produtos liberam o acesso"
          hint="Uma linha para cada assinatura ou produto vendido na Hotmart."
        >
          <PlanRows rows={planRows} />
          <AddPlanForm />
        </SetupStep>

        <SetupStep
          title="4 · Liberar o acesso sozinho"
          hint={describeUnlocking(unlocksPlansAt)}
        >
          <UnlockSwitch
            isOn={unlocksPlansAt != null}
            stateLabel={
              unlocksPlansAt == null
                ? "Desligado"
                : `Ligado em ${formatUpdatedAt(unlocksPlansAt)}`
            }
          />
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

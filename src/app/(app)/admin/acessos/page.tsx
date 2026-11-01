import type { Metadata } from "next";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getDatabase } from "@/db/client";
import {
  GrantAccessForm,
  RevokeAccessButton,
} from "@/features/admin/components/access-grants";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { describeGrantedCount } from "@/features/admin/email-list";
import {
  type AccessGrantRow,
  listAccessGrants,
} from "@/features/billing/access-grants";
import { PLANS } from "@/features/plans/plans";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Acessos" };

function GrantItem(props: { row: AccessGrantRow }): ReactElement {
  const { row } = props;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="min-w-0 flex-1 basis-full truncate sm:basis-auto">
        {row.email}
      </span>
      <Badge variant={row.hasAccount ? "secondary" : "outline"}>
        {row.hasAccount ? "Conta criada" : "Sem conta ainda"}
      </Badge>
      <span className="font-medium">{PLANS[row.plan].label}</span>
      <RevokeAccessButton email={row.email} />
    </li>
  );
}

export default async function AdminAccessPage(): Promise<ReactElement> {
  await requireAdmin();
  const rows = await listAccessGrants(getDatabase());

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="acessos" />

      <section
        className="flex flex-col gap-3"
        aria-label="Liberar acesso por e-mail"
      >
        <div>
          <h2 className="text-lg font-semibold">Liberar acesso por e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Quem já tem conta ganha o plano na hora. Quem ainda não tem ganha ao
            criar a conta com esse e-mail.
          </p>
        </div>
        <GrantAccessForm />
      </section>

      <section className="flex flex-col gap-2" aria-label="E-mails liberados">
        <h2 className="text-lg font-semibold">
          {describeGrantedCount(rows.length)}
        </h2>

        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum e-mail liberado ainda.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <GrantItem key={row.email} row={row} />
          ))}
        </ul>
      </section>
    </div>
  );
}

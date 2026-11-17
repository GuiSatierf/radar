import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { AffiliateImportForm } from "@/features/admin/components/affiliate-import-form";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Afiliados" };

export default async function AdminAffiliatesPage(): Promise<ReactElement> {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="afiliados" />

      <section className="flex flex-col gap-3" aria-label="Número de afiliados">
        <div>
          <h2 className="text-lg font-semibold">Número de afiliados</h2>
          <p className="text-sm text-muted-foreground">
            Envie o arquivo com quantos afiliados divulgam cada produto. O Radar
            mostra o número e refaz a nota de cada produto na hora. Linha sem
            número não apaga o número que já estava, e a coleta diária da Shopee
            também não.
          </p>
        </div>
        <section className="rounded-xl border border-border p-4">
          <AffiliateImportForm />
        </section>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { AdForm } from "@/features/ads/components/ad-form";
import { getAdForAdmin } from "@/features/ads/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Editar anúncio" };

const AD_ID = /^[1-9]\d{0,9}$/;

export default async function EditAdPage(
  props: PageProps<"/admin/anuncios/[id]">,
): Promise<ReactElement> {
  const admin = await requireAdmin();
  const { id } = await props.params;

  if (!AD_ID.test(id)) notFound();

  const ad = await getAdForAdmin(
    getDatabase(),
    Number(id),
    admin.commissionProfile,
  );

  if (ad == null) notFound();

  const productLink =
    ad.product == null ? (ad.productUrl ?? "") : `/radar/${ad.product.id}`;

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="anuncios" />
      <h2 className="text-lg font-semibold">Editar anúncio</h2>
      {!ad.isManual && (
        <p className="max-w-2xl rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Este anúncio veio da coleta automática. Depois que você salvar, a
          coleta não muda mais o texto, o produto nem a data de início: só
          continua conferindo se ele está no ar.
        </p>
      )}
      <AdForm
        editingId={ad.id}
        defaults={{
          libraryLink: ad.libraryUrl,
          advertiserName: ad.advertiserName,
          adText: ad.adText,
          startedOn: ad.startedOn,
          productLink,
          platforms: [...ad.platforms],
        }}
      />
    </div>
  );
}

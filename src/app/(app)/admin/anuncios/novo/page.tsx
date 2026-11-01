import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { AdForm } from "@/features/ads/components/ad-form";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · Novo anúncio" };

const EMPTY_FORM = {
  libraryLink: "",
  advertiserName: "",
  adText: "",
  startedOn: "",
  productLink: "",
  platforms: [],
};

export default async function NewAdPage(): Promise<ReactElement> {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="anuncios" />
      <h2 className="text-lg font-semibold">Novo anúncio</h2>
      <AdForm editingId={null} defaults={EMPTY_FORM} />
    </div>
  );
}

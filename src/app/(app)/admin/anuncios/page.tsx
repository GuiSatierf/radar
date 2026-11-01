import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getDatabase } from "@/db/client";
import { AdminTabs } from "@/features/admin/components/admin-tabs";
import { CollectionCard } from "@/features/admin/components/stat-cards";
import { getLastCollection } from "@/features/admin/queries";
import { AdRowActions } from "@/features/ads/components/ad-row-actions";
import {
  AD_ORIGINS,
  type AdOrigin,
  formatCalendarDay,
  formatDaysOnAir,
} from "@/features/ads/domain/ads";
import { type AdCardData, listAdsForAdmin } from "@/features/ads/queries";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Anúncios" };

const ORIGIN_LABEL: Readonly<Record<AdOrigin, string>> = {
  todos: "Todos",
  manuais: "Manuais",
  automaticos: "Automáticos",
};

function parseOrigin(value: string | string[] | undefined): AdOrigin {
  return AD_ORIGINS.find((origin) => origin === value) ?? "todos";
}

function OriginFilter(props: { active: AdOrigin }): ReactElement {
  return (
    <nav aria-label="Origem dos anúncios" className="flex flex-wrap gap-2">
      {AD_ORIGINS.map((origin) => (
        <Link
          key={origin}
          href={
            origin === "todos"
              ? "/admin/anuncios"
              : `/admin/anuncios?origem=${origin}`
          }
          aria-current={props.active === origin ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-lg border px-3 text-sm",
            props.active === origin
              ? "border-transparent bg-accent font-medium text-accent-foreground"
              : "border-input hover:bg-muted",
          )}
        >
          {ORIGIN_LABEL[origin]}
        </Link>
      ))}
    </nav>
  );
}

function AdItem(props: { ad: AdCardData }): ReactElement {
  const { ad } = props;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{ad.advertiserName}</span>
          <Badge variant="outline">
            {ad.isManual ? "Manual" : "Automático"}
          </Badge>
          {!ad.isActive && <Badge variant="secondary">Parou</Badge>}
          {ad.isHidden && <Badge variant="destructive">Escondido</Badge>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {ad.product?.name ?? "Produto fora do catálogo"}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDaysOnAir(ad.daysOnAir, ad.isActive)} · visto em{" "}
          {formatCalendarDay(ad.lastSeenOn, { withYear: true })}
        </p>
      </div>
      <AdRowActions
        id={ad.id}
        advertiserName={ad.advertiserName}
        isManual={ad.isManual}
        isHidden={ad.isHidden}
      />
    </li>
  );
}

export default async function AdminAdsPage(
  props: PageProps<"/admin/anuncios">,
): Promise<ReactElement> {
  const admin = await requireAdmin();
  const origin = parseOrigin((await props.searchParams).origem);
  const db = getDatabase();

  const [ads, lastCollection] = await Promise.all([
    listAdsForAdmin(db, admin.commissionProfile, origin),
    getLastCollection(db, "ads"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminTabs active="anuncios" />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <CollectionCard kind="ads" run={lastCollection} />
        <Link
          href="/admin/anuncios/novo"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" aria-hidden />
          Novo anúncio
        </Link>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Os automáticos vêm da coleta diária, que confere sozinha se ainda estão
        no ar; esconda os que não servem. Os manuais você confere: abra, veja se
        ainda estão no ar e marque “Conferi hoje”, ou tire da lista. Os vistos
        há mais tempo aparecem primeiro.
      </p>

      <OriginFilter active={origin} />

      {ads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhum anúncio aqui ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ads.map((ad) => (
            <AdItem key={ad.id} ad={ad} />
          ))}
        </ul>
      )}
    </div>
  );
}

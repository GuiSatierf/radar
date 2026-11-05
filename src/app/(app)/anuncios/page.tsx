import { Megaphone, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { getDatabase } from "@/db/client";
import { AdCard } from "@/features/ads/components/ad-card";
import {
  AdsFilterBar,
  AdsSortSelect,
} from "@/features/ads/components/ads-filters";
import { formatCalendarDay } from "@/features/ads/domain/ads";
import {
  PAGE_SIZE,
  parseAdFilters,
  toAdSearchParams,
} from "@/features/ads/filters";
import {
  getLastCheckedOn,
  listAdCategories,
  listAds,
} from "@/features/ads/queries";
import { LockedTool } from "@/features/plans/components/locked-tool";
import { checkToolAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Anúncios" };

function EmptyResults(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-input px-6 py-14 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">Nenhum anúncio com esses filtros</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tire um filtro ou busque outra palavra.
      </p>
      <Link href="/anuncios" className="mt-1 text-sm font-medium text-primary">
        Limpar tudo
      </Link>
    </div>
  );
}

export default async function AnunciosPage(
  props: PageProps<"/anuncios">,
): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("anuncios");

  if (isAllowed === false) return <LockedTool />;

  const filters = parseAdFilters(await props.searchParams);
  const db = getDatabase();

  const [{ items, total }, categories, lastCheckedOn] = await Promise.all([
    listAds({ db, filters, profile: user.commissionProfile }),
    listAdCategories(db),
    getLastCheckedOn(db),
  ]);

  // Nothing curated yet: say what will be here instead of an empty filter bar.
  if (lastCheckedOn == null) {
    return (
      <ComingSoon
        icon={Megaphone}
        title="Os anúncios vão aparecer aqui"
        description="A equipe escolhe anúncios de produtos da Shopee que estão no ar há bastante tempo. Os primeiros chegam em breve."
      />
    );
  }

  const moreParams = toAdSearchParams({
    ...filters,
    limit: filters.limit + PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Quanto mais tempo um anúncio fica no ar, maior a chance de ele estar
        dando lucro.
      </p>

      <AdsFilterBar filters={filters} categories={categories} total={total} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total === 1 ? "1 anúncio" : `${total} anúncios`} · conferidos em{" "}
          {formatCalendarDay(lastCheckedOn, { withYear: false })}
        </p>
        <AdsSortSelect filters={filters} />
      </div>

      {items.length === 0 ? (
        <EmptyResults />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((ad) => (
            <li key={ad.id} className="flex">
              <AdCard ad={ad} />
            </li>
          ))}
        </ul>
      )}

      {items.length < total && (
        <Link
          href={`/anuncios?${moreParams.toString()}`}
          scroll={false}
          className="mx-auto rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Mostrar mais anúncios
        </Link>
      )}
    </div>
  );
}

import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { getDatabase } from "@/db/client";
import { LockedTool } from "@/features/plans/components/locked-tool";
import { ProductCard } from "@/features/radar/components/product-card";
import {
  RadarFilterBar,
  SortSelect,
} from "@/features/radar/components/radar-filters";
import { formatUpdatedAt } from "@/features/radar/domain/format";
import {
  PAGE_SIZE,
  parseRadarFilters,
  toSearchParams,
} from "@/features/radar/filters";
import {
  getCatalogFacts,
  getLastCollectedAt,
  listCategories,
  listRadarProducts,
} from "@/features/radar/queries";
import { checkToolAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Radar" };

function EmptyResults(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-input px-6 py-14 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">Nenhum produto com esses filtros</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tire um filtro ou busque outra palavra.
      </p>
      <Link href="/radar" className="mt-1 text-sm font-medium text-primary">
        Limpar tudo
      </Link>
    </div>
  );
}

export default async function RadarPage(
  props: PageProps<"/radar">,
): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("radar");

  if (!isAllowed) return <LockedTool tool="radar" plan={user.plan} />;

  const filters = parseRadarFilters(await props.searchParams);
  const db = getDatabase();

  const [{ items, total }, categories, lastCollectedAt, facts] =
    await Promise.all([
      listRadarProducts({ db, filters, profile: user.commissionProfile }),
      listCategories(db),
      getLastCollectedAt(db),
      getCatalogFacts(db),
    ]);
  const moreParams = toSearchParams({
    ...filters,
    limit: filters.limit + PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-4">
      <RadarFilterBar
        filters={filters}
        categories={categories}
        facts={facts}
        total={total}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {total === 1 ? "1 produto" : `${total} produtos`}
          {lastCollectedAt != null &&
            ` · atualizado em ${formatUpdatedAt(lastCollectedAt)}`}
        </p>
        <SortSelect filters={filters} facts={facts} />
      </div>

      {items.length === 0 ? (
        <EmptyResults />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((product) => (
            <li key={product.id} className="flex">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}

      {items.length < total && (
        <Link
          href={`/radar?${moreParams.toString()}`}
          scroll={false}
          className="mx-auto rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Mostrar mais produtos
        </Link>
      )}
    </div>
  );
}

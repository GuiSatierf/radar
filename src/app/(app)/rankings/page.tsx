import type { Metadata } from "next";
import type { ReactElement } from "react";
import { getDatabase } from "@/db/client";
import { todayInBrazil } from "@/features/ads/domain/ads";
import { LockedTool } from "@/features/plans/components/locked-tool";
import type { CommissionProfile } from "@/features/radar/domain/commission";
import { listCategories } from "@/features/radar/queries";
import { RankingNav } from "@/features/rankings/components/ranking-nav";
import { RankingRow } from "@/features/rankings/components/ranking-row";
import {
  parseRankingFilters,
  RANKING_DESCRIPTION,
  type RankingFilters,
} from "@/features/rankings/filters";
import {
  listRisingProducts,
  listTopProducts,
  type RankedProduct,
} from "@/features/rankings/queries";
import { checkToolAccess } from "@/lib/session";

export const metadata: Metadata = { title: "Rankings" };

const EMPTY_TEXT = {
  list: "Nenhum produto nesta categoria por enquanto.",
  rising:
    "Esta lista começa a aparecer depois de alguns dias de coleta, quando dá para comparar as vendas.",
};

async function loadRanking(
  filters: RankingFilters,
  profile: CommissionProfile,
): Promise<RankedProduct[]> {
  const db = getDatabase();

  if (filters.list === "em-alta") {
    return listRisingProducts({
      db,
      category: filters.category,
      profile,
      today: todayInBrazil(new Date()),
    });
  }

  return listTopProducts({
    db,
    list: filters.list,
    category: filters.category,
    profile,
  });
}

export default async function RankingsPage(
  props: PageProps<"/rankings">,
): Promise<ReactElement> {
  const { user, isAllowed } = await checkToolAccess("rankings");

  if (!isAllowed) return <LockedTool />;

  const filters = parseRankingFilters(await props.searchParams);
  const [items, categories] = await Promise.all([
    loadRanking(filters, user.commissionProfile),
    listCategories(getDatabase()),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RankingNav filters={filters} categories={categories} />
      <p className="text-sm text-muted-foreground">
        {RANKING_DESCRIPTION[filters.list]}
      </p>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-input px-6 py-14 text-center text-sm text-muted-foreground">
          {filters.list === "em-alta" ? EMPTY_TEXT.rising : EMPTY_TEXT.list}
        </p>
      ) : (
        <ol className="grid gap-2 lg:grid-cols-2">
          {items.map((product, index) => (
            <li key={product.id} className="flex">
              <RankingRow
                position={index + 1}
                list={filters.list}
                product={product}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import { and, asc, between, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { product, productSalesDay } from "@/db/schema";
import type { CommissionProfile } from "@/features/radar/domain/commission";
import {
  earningsScaledSql,
  type ProductCardData,
  toCard,
} from "@/features/radar/queries";
import { daysBefore } from "@/lib/calendar-day";
import { RANKING_SIZE } from "./filters";

export interface RankedProduct extends ProductCardData {
  /** "Em alta" only: how many more sales than on `since`. */
  readonly growth: { readonly sales: number; readonly since: string } | null;
}

/** "Em alta" compares today with a day 3 to 7 days back: less than 3 days is mostly noise. */
const RISING_MIN_DAYS = 3;
const RISING_MAX_DAYS = 7;

function categoryCondition(category: string | null): SQL | undefined {
  if (category == null) return undefined;

  return eq(product.categorySlug, category) as SQL;
}

/** "Mais vendidos" or "Maior ganho", the top of the whole catalog or of one category. */
export async function listTopProducts(input: {
  db: Database;
  list: "vendas" | "ganho";
  category: string | null;
  profile: CommissionProfile;
}): Promise<RankedProduct[]> {
  const order: Record<"vendas" | "ganho", SQL[]> = {
    vendas: [desc(product.monthlySales), desc(product.opportunityScore)],
    ganho: [desc(earningsScaledSql(input.profile)), desc(product.monthlySales)],
  };

  const rows = await input.db
    .select()
    .from(product)
    .where(categoryCondition(input.category))
    .orderBy(...order[input.list], asc(product.id))
    .limit(RANKING_SIZE);

  return rows.map((row) => ({ ...toCard(row, input.profile), growth: null }));
}

/**
 * "Em alta": the biggest increase in sales since the earliest recorded day 3 to 7 days ago.
 * Empty until the collection has run for at least 3 days.
 */
export async function listRisingProducts(input: {
  db: Database;
  category: string | null;
  profile: CommissionProfile;
  today: string;
}): Promise<RankedProduct[]> {
  const baseline = input.db
    .selectDistinctOn([productSalesDay.productId], {
      productId: productSalesDay.productId,
      day: productSalesDay.day,
      monthlySales: productSalesDay.monthlySales,
    })
    .from(productSalesDay)
    .where(
      between(
        productSalesDay.day,
        daysBefore(input.today, RISING_MAX_DAYS),
        daysBefore(input.today, RISING_MIN_DAYS),
      ),
    )
    .orderBy(productSalesDay.productId, asc(productSalesDay.day))
    .as("baseline");
  const growth = sql<number>`${product.monthlySales} - ${baseline.monthlySales}`;

  const rows = await input.db
    .select({ product, since: baseline.day, growth })
    .from(product)
    .innerJoin(baseline, eq(baseline.productId, product.id))
    .where(and(gt(growth, 0), categoryCondition(input.category)))
    .orderBy(desc(growth), asc(product.id))
    .limit(RANKING_SIZE);

  return rows.map((row) => ({
    ...toCard(row.product, input.profile),
    growth: { sales: Number(row.growth), since: row.since },
  }));
}

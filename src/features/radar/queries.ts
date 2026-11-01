import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  lte,
  max,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { product, productVideo } from "@/db/schema";
import { containsPattern } from "@/lib/like-pattern";
import {
  type CommissionProfile,
  earningsPerSaleCents,
  shopeeRateBasisPoints,
  totalRateBasisPoints,
} from "./domain/commission";
import { COMPETITION_RANGE, type CompetitionLevel } from "./domain/competition";
import type { RadarFilters, SortOption, TagOption } from "./filters";

export interface ProductCardData {
  readonly id: string;
  readonly name: string;
  readonly categoryLabel: string;
  readonly imageUrl: string | null;
  readonly priceCents: number;
  readonly earningsCents: number;
  readonly affiliateCount: number | null;
  readonly affiliateCountIsMinimum: boolean;
  readonly monthlySales: number;
  readonly opportunityScore: number;
  readonly hasFreeSample: boolean;
  readonly hasExtraCommission: boolean;
}

export interface ProductDetailData extends ProductCardData {
  readonly shopName: string;
  readonly productUrl: string;
  readonly imageUrls: readonly string[];
  readonly priceMaxCents: number;
  readonly sellerRateBasisPoints: number;
  readonly totalRateBasisPoints: number;
  readonly ratingTenths: number | null;
  readonly ratingCount: number | null;
  readonly stock: number | null;
  readonly collectedAt: Date;
  readonly videos: readonly {
    rank: number;
    creatorHandle: string;
    views: number;
    videoUrl: string | null;
  }[];
}

const BASIS_POINTS_TOTAL = 10_000;

/** price × (Shopee share of the profile + shop share), in cents × 10,000 (integer math in SQL). */
export function earningsScaledSql(profile: CommissionProfile): SQL<number> {
  return sql<number>`${product.priceCents} * (${shopeeRateBasisPoints(profile)} + ${product.sellerRateBasisPoints})`;
}

const TAG_CONDITION: Record<TagOption, SQL> = {
  "comissao-extra": gt(product.sellerRateBasisPoints, 0) as SQL,
  "amostra-gratis": eq(product.hasFreeSample, true) as SQL,
  natal: sql`'natal' = any(${product.seasonalTags})`,
};

/**
 * The screen rounds earnings to whole cents, so the filter must too: anything that rounds up to
 * the minimum (x ≥ min − 0.5 cent) counts, or a product shown as R$ 5,00 would miss "R$ 5".
 */
function minEarningsCondition(
  minEarningsCents: number | null,
  profile: CommissionProfile,
): SQL | undefined {
  if (minEarningsCents == null) return undefined;

  const halfCentScaled = BASIS_POINTS_TOTAL / 2;

  return gte(
    earningsScaledSql(profile),
    minEarningsCents * BASIS_POINTS_TOTAL - halfCentScaled,
  );
}

function competitionConditions(level: CompetitionLevel | null): SQL[] {
  if (level == null) return [];

  const range = COMPETITION_RANGE[level];
  const conditions = [gte(product.affiliateCount, range.min) as SQL];

  if (range.max != null)
    conditions.push(lte(product.affiliateCount, range.max) as SQL);

  // "10+" may hide hundreds of affiliates: it never counts as low or medium.
  if (!range.allowsMinimumCounts) {
    conditions.push(eq(product.affiliateCountIsMinimum, false) as SQL);
  }

  return conditions;
}

function whereClause(
  filters: RadarFilters,
  profile: CommissionProfile,
): SQL | undefined {
  return and(
    filters.search == null
      ? undefined
      : ilike(product.name, containsPattern(filters.search)),
    filters.category == null
      ? undefined
      : eq(product.categorySlug, filters.category),
    minEarningsCondition(filters.minEarningsCents, profile),
    ...filters.tags.map((tag) => TAG_CONDITION[tag]),
    ...competitionConditions(filters.competition),
  );
}

function orderBy(sort: SortOption, profile: CommissionProfile): SQL[] {
  const byOrder: Record<SortOption, SQL[]> = {
    nota: [desc(product.opportunityScore), desc(product.monthlySales)],
    concorrencia: [asc(product.affiliateCount), desc(product.opportunityScore)],
    ganho: [desc(earningsScaledSql(profile))],
    vendas: [desc(product.monthlySales)],
  };

  return [...byOrder[sort], asc(product.id)];
}

export type ProductRow = typeof product.$inferSelect;

export function toCard(
  row: ProductRow,
  profile: CommissionProfile,
): ProductCardData {
  return {
    id: row.id,
    name: row.name,
    categoryLabel: row.categoryLabel,
    imageUrl: row.imageUrls[0] ?? null,
    priceCents: row.priceCents,
    earningsCents: earningsPerSaleCents({
      priceCents: row.priceCents,
      profile,
      sellerRateBasisPoints: row.sellerRateBasisPoints,
    }),
    affiliateCount: row.affiliateCount,
    affiliateCountIsMinimum: row.affiliateCountIsMinimum,
    monthlySales: row.monthlySales,
    opportunityScore: row.opportunityScore,
    hasFreeSample: row.hasFreeSample,
    hasExtraCommission: row.sellerRateBasisPoints > 0,
  };
}

export async function listRadarProducts(input: {
  db: Database;
  filters: RadarFilters;
  profile: CommissionProfile;
}): Promise<{ items: ProductCardData[]; total: number }> {
  const where = whereClause(input.filters, input.profile);

  const [rows, totals] = await Promise.all([
    input.db
      .select()
      .from(product)
      .where(where)
      .orderBy(...orderBy(input.filters.sort, input.profile))
      .limit(input.filters.limit),
    input.db.select({ total: count() }).from(product).where(where),
  ]);

  return {
    items: rows.map((row) => toCard(row, input.profile)),
    total: totals[0]?.total ?? 0,
  };
}

export async function listCategories(
  db: Database,
): Promise<{ slug: string; label: string }[]> {
  return db
    .selectDistinct({
      slug: product.categorySlug,
      label: product.categoryLabel,
    })
    .from(product)
    .orderBy(asc(product.categoryLabel));
}

export interface CatalogFacts {
  /** False while no product has an affiliate count: every competition filter would be empty. */
  readonly hasAffiliateCounts: boolean;
  /** False when no product has a free sample (the Shopee API does not say it). */
  readonly hasFreeSamples: boolean;
}

/** What the catalog has at all, so the screen never offers a filter that can only be empty. */
export async function getCatalogFacts(db: Database): Promise<CatalogFacts> {
  const [row] = await db
    .select({
      hasAffiliateCounts: sql<boolean>`coalesce(bool_or(${product.affiliateCount} is not null), false)`,
      hasFreeSamples: sql<boolean>`coalesce(bool_or(${product.hasFreeSample}), false)`,
    })
    .from(product);

  return {
    hasAffiliateCounts: row?.hasAffiliateCounts ?? false,
    hasFreeSamples: row?.hasFreeSamples ?? false,
  };
}

/** When the catalog was last refreshed; null before the first collection. */
export async function getLastCollectedAt(db: Database): Promise<Date | null> {
  const [row] = await db
    .select({ last: max(product.collectedAt) })
    .from(product);

  return row?.last ?? null;
}

export async function getProductDetail(input: {
  db: Database;
  id: string;
  profile: CommissionProfile;
}): Promise<ProductDetailData | null> {
  // Both only need the id, so they run together.
  const [rows, videos] = await Promise.all([
    input.db.select().from(product).where(eq(product.id, input.id)).limit(1),
    input.db
      .select({
        rank: productVideo.rank,
        creatorHandle: productVideo.creatorHandle,
        views: productVideo.views,
        videoUrl: productVideo.videoUrl,
      })
      .from(productVideo)
      .where(eq(productVideo.productId, input.id))
      .orderBy(asc(productVideo.rank)),
  ]);
  const row = rows[0];

  if (row == null) return null;

  return {
    ...toCard(row, input.profile),
    shopName: row.shopName,
    productUrl: row.productUrl,
    imageUrls: row.imageUrls,
    priceMaxCents: row.priceMaxCents,
    sellerRateBasisPoints: row.sellerRateBasisPoints,
    totalRateBasisPoints: totalRateBasisPoints({
      profile: input.profile,
      sellerRateBasisPoints: row.sellerRateBasisPoints,
    }),
    ratingTenths: row.ratingTenths,
    ratingCount: row.ratingCount,
    stock: row.stock,
    collectedAt: row.collectedAt,
    videos,
  };
}

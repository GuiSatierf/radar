import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  max,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { ad, product } from "@/db/schema";
import {
  type CommissionProfile,
  earningsPerSaleCents,
} from "@/features/radar/domain/commission";
import { containsPattern } from "@/lib/like-pattern";
import {
  type AdOrigin,
  type AdPlatform,
  daysOnAir,
  isAdPlatform,
  libraryUrlFor,
  MANUAL_SOURCE,
} from "./domain/ads";
import { type AdFilters, type AdSortOption, AGE_RANGE } from "./filters";

export interface AdProduct {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly priceCents: number;
  readonly earningsCents: number;
}

export interface AdCardData {
  readonly id: number;
  readonly libraryUrl: string;
  readonly advertiserName: string;
  readonly adText: string;
  readonly platforms: readonly AdPlatform[];
  readonly startedOn: string;
  readonly lastSeenOn: string;
  readonly daysOnAir: number;
  /** Null when the ad sells something outside our catalog. */
  readonly product: AdProduct | null;
  readonly productUrl: string | null;
  readonly isActive: boolean;
  readonly isHidden: boolean;
  readonly isManual: boolean;
}

/** Days on air in SQL (date minus date is a whole number of days in Postgres). */
const daysOnAirSql = sql<number>`(${ad.lastSeenOn} - ${ad.startedOn})`;

function ageConditions(filters: AdFilters): SQL[] {
  if (filters.age == null) return [];

  const range = AGE_RANGE[filters.age];
  const conditions = [gte(daysOnAirSql, range.min)];

  if (range.max != null) conditions.push(lte(daysOnAirSql, range.max));

  return conditions;
}

function whereClause(filters: AdFilters): SQL | undefined {
  const pattern =
    filters.search == null ? null : containsPattern(filters.search);

  return and(
    // Hidden ads are the admin's call: subscribers never see them.
    eq(ad.isHidden, false),
    filters.onlyActive ? eq(ad.isActive, true) : undefined,
    pattern == null
      ? undefined
      : or(
          ilike(ad.advertiserName, pattern),
          ilike(ad.adText, pattern),
          ilike(product.name, pattern),
        ),
    filters.category == null
      ? undefined
      : eq(product.categorySlug, filters.category),
    ...ageConditions(filters),
  );
}

const ORDER_BY: Readonly<Record<AdSortOption, SQL[]>> = {
  "mais-tempo": [desc(daysOnAirSql), desc(ad.id)],
  recentes: [desc(ad.startedOn), desc(ad.id)],
};

const cardColumns = {
  id: ad.id,
  libraryAdId: ad.libraryAdId,
  advertiserName: ad.advertiserName,
  adText: ad.adText,
  platforms: ad.platforms,
  startedOn: ad.startedOn,
  lastSeenOn: ad.lastSeenOn,
  productUrl: ad.productUrl,
  source: ad.source,
  isActive: ad.isActive,
  isHidden: ad.isHidden,
  productId: product.id,
  productName: product.name,
  imageUrls: product.imageUrls,
  priceCents: product.priceCents,
  sellerRateBasisPoints: product.sellerRateBasisPoints,
};

function selectCards(db: Database) {
  return db
    .select(cardColumns)
    .from(ad)
    .leftJoin(product, eq(product.id, ad.productId));
}

type CardRow = Awaited<ReturnType<typeof selectCards>>[number];

function toProduct(row: CardRow, profile: CommissionProfile): AdProduct | null {
  if (row.productId == null || row.productName == null) return null;

  if (row.priceCents == null) return null;

  return {
    id: row.productId,
    name: row.productName,
    imageUrl: row.imageUrls?.[0] ?? null,
    priceCents: row.priceCents,
    earningsCents: earningsPerSaleCents({
      priceCents: row.priceCents,
      profile,
      sellerRateBasisPoints: row.sellerRateBasisPoints ?? 0,
    }),
  };
}

function toCard(row: CardRow, profile: CommissionProfile): AdCardData {
  return {
    id: row.id,
    libraryUrl: libraryUrlFor(row.libraryAdId),
    advertiserName: row.advertiserName,
    adText: row.adText,
    platforms: row.platforms.filter(isAdPlatform),
    startedOn: row.startedOn,
    lastSeenOn: row.lastSeenOn,
    daysOnAir: daysOnAir(row.startedOn, row.lastSeenOn),
    product: toProduct(row, profile),
    productUrl: row.productUrl,
    isActive: row.isActive,
    isHidden: row.isHidden,
    isManual: row.source === MANUAL_SOURCE,
  };
}

export async function listAds(input: {
  db: Database;
  filters: AdFilters;
  profile: CommissionProfile;
}): Promise<{ items: AdCardData[]; total: number }> {
  const where = whereClause(input.filters);

  const [rows, [totals]] = await Promise.all([
    selectCards(input.db)
      .where(where)
      .orderBy(...ORDER_BY[input.filters.sort])
      .limit(input.filters.limit),
    input.db
      .select({ total: count() })
      .from(ad)
      .leftJoin(product, eq(product.id, ad.productId))
      .where(where),
  ]);

  return {
    items: rows.map((row) => toCard(row, input.profile)),
    total: totals?.total ?? 0,
  };
}

/** Only categories that have at least one ad, so no choice leads to an empty list. */
export async function listAdCategories(
  db: Database,
): Promise<{ slug: string; label: string }[]> {
  return db
    .selectDistinct({
      slug: product.categorySlug,
      label: product.categoryLabel,
    })
    .from(ad)
    .innerJoin(product, eq(product.id, ad.productId))
    .orderBy(asc(product.categoryLabel));
}

/** The most recent day someone checked the ads, shown as "conferidos em". */
export async function getLastCheckedOn(db: Database): Promise<string | null> {
  const [row] = await db.select({ last: max(ad.lastSeenOn) }).from(ad);

  return row?.last ?? null;
}

const ORIGIN_CONDITION: Readonly<Record<AdOrigin, SQL | undefined>> = {
  todos: undefined,
  manuais: eq(ad.source, MANUAL_SOURCE),
  automaticos: ne(ad.source, MANUAL_SOURCE),
};

/** For the admin: every ad, hidden ones included, the ones checked longest ago first. */
export async function listAdsForAdmin(
  db: Database,
  profile: CommissionProfile,
  origin: AdOrigin,
): Promise<AdCardData[]> {
  const rows = await selectCards(db)
    .where(ORIGIN_CONDITION[origin])
    .orderBy(asc(ad.lastSeenOn), desc(ad.id));

  return rows.map((row) => toCard(row, profile));
}

export async function getAdForAdmin(
  db: Database,
  id: number,
  profile: CommissionProfile,
): Promise<AdCardData | null> {
  const [row] = await selectCards(db).where(eq(ad.id, id)).limit(1);

  return row == null ? null : toCard(row, profile);
}

/** Matches a pasted Shopee link to a catalog product with the same link. */
export async function findProductIdByUrl(
  db: Database,
  url: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.productUrl, url))
    .limit(1);

  return row?.id ?? null;
}

export async function productExists(
  db: Database,
  id: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, id))
    .limit(1);

  return row != null;
}

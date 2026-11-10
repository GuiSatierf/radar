import {
  and,
  count,
  getTableColumns,
  inArray,
  lt,
  max,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { product, productSalesDay, productVideo } from "@/db/schema";
import { todayInBrazil } from "@/features/ads/domain/ads";
import {
  DEFAULT_COMMISSION_PROFILE,
  earningsPerSaleCents,
} from "@/features/radar/domain/commission";
import { calculateOpportunityScore } from "@/features/radar/domain/opportunity-score";
import { daysBefore } from "@/lib/calendar-day";
import {
  type ProductSnapshot,
  type ProductSource,
  productSnapshotSchema,
} from "./product-source";

export interface CollectionResult {
  readonly saved: number;
  readonly skipped: number;
  readonly removed: number;
  /** True when the source returned far fewer products than we had, so nothing was deleted. */
  readonly removalSkipped: boolean;
}

export class EmptySourceError extends Error {
  constructor(sourceName: string) {
    super(
      `Source "${sourceName}" returned no valid products; nothing was changed.`,
    );
    this.name = "EmptySourceError";
  }
}

/** Below this share of the current catalog, a response looks partial (e.g. a failed page). */
const MIN_SHARE_TO_REMOVE = 0.5;
/** Rows per statement: well under Postgres' 65,535-parameter limit for ~20 columns. */
const CHUNK_SIZE = 500;
/** Enough history for "Em alta" (a week back) with room to spare. */
const SALES_HISTORY_DAYS = 35;
/** A product not refreshed for this long is removed even when its category did not come back. */
const STALE_AFTER_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

/** The score uses the default 3% profile, so every user sees the same ranking. */
function scoreOf(snapshot: ProductSnapshot): number {
  return calculateOpportunityScore({
    affiliateCount: snapshot.affiliateCount,
    affiliateCountIsMinimum: snapshot.affiliateCountIsMinimum,
    monthlySales: snapshot.monthlySales,
    earningsPerSaleCents: earningsPerSaleCents({
      priceCents: snapshot.priceCents,
      profile: DEFAULT_COMMISSION_PROFILE,
      sellerRateBasisPoints: snapshot.sellerRateBasisPoints,
    }),
  });
}

function validSnapshots(raw: readonly unknown[]): ProductSnapshot[] {
  return raw.flatMap((item) => {
    const parsed = productSnapshotSchema.safeParse(item);

    return parsed.success ? [parsed.data] : [];
  });
}

function chunk<T>(items: readonly T[]): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / CHUNK_SIZE) },
    (_, index) => items.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
}

/** On conflict, every column except the id takes the incoming value. */
function updateAllColumnsFromExcluded(): Record<string, SQL> {
  const { id: _id, ...columns } = getTableColumns(product);

  return Object.fromEntries(
    Object.entries(columns).map(([key, column]) => [
      key,
      sql.raw(`excluded."${column.name}"`),
    ]),
  );
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function saveProducts(
  tx: Transaction,
  snapshots: readonly ProductSnapshot[],
  now: Date,
): Promise<void> {
  const rows = snapshots.map((snapshot) => {
    const { videos: _videos, ...fields } = snapshot;

    return { ...fields, opportunityScore: scoreOf(snapshot), collectedAt: now };
  });
  const set = updateAllColumnsFromExcluded();

  for (const part of chunk(rows)) {
    await tx
      .insert(product)
      .values(part)
      .onConflictDoUpdate({ target: product.id, set });
  }
}

/** Today's sales of every collected product; a second collection on the same day overwrites. */
async function recordSalesDay(
  tx: Transaction,
  snapshots: readonly ProductSnapshot[],
  now: Date,
): Promise<void> {
  const day = todayInBrazil(now);
  const rows = snapshots.map((snapshot) => ({
    productId: snapshot.id,
    day,
    monthlySales: snapshot.monthlySales,
  }));

  for (const part of chunk(rows)) {
    await tx
      .insert(productSalesDay)
      .values(part)
      .onConflictDoUpdate({
        target: [productSalesDay.productId, productSalesDay.day],
        set: { monthlySales: sql.raw(`excluded."monthly_sales"`) },
      });
  }

  await tx
    .delete(productSalesDay)
    .where(lt(productSalesDay.day, daysBefore(day, SALES_HISTORY_DAYS)));
}

async function replaceVideos(
  tx: Transaction,
  snapshots: readonly ProductSnapshot[],
): Promise<void> {
  const videos = snapshots.flatMap((snapshot) =>
    snapshot.videos.map((video) => ({ ...video, productId: snapshot.id })),
  );

  for (const ids of chunk(snapshots.map((snapshot) => snapshot.id))) {
    await tx.delete(productVideo).where(inArray(productVideo.productId, ids));
  }

  for (const part of chunk(videos)) {
    await tx.insert(productVideo).values(part);
  }
}

async function lastCollectedAtByCategory(
  db: Database,
): Promise<Map<string, Date>> {
  const rows = await db
    .select({ slug: product.categorySlug, lastAt: max(product.collectedAt) })
    .from(product)
    .groupBy(product.categorySlug);

  return new Map(
    rows.flatMap((row) => (row.lastAt == null ? [] : [[row.slug, row.lastAt]])),
  );
}

/**
 * Replaces the catalog with what the source has now, in one transaction. Products the source no
 * longer returns are removed, but only in the categories the response brought (a category that
 * failed at the source keeps yesterday's products, up to a week), and not at all when the response is much
 * smaller than the current catalog (a partial fetch must never wipe the Radar). An empty or fully
 * invalid response changes nothing.
 */
export async function collectProducts(input: {
  db: Database;
  source: ProductSource;
  now: Date;
}): Promise<CollectionResult> {
  const raw = await input.source.fetchProducts({
    lastCollectedAtByCategory: await lastCollectedAtByCategory(input.db),
  });
  const snapshots = validSnapshots(raw);

  if (snapshots.length === 0) throw new EmptySourceError(input.source.name);

  return input.db.transaction(async (tx) => {
    const [current] = await tx.select({ total: count() }).from(product);
    const currentTotal = current?.total ?? 0;
    const removalSkipped =
      snapshots.length < currentTotal * MIN_SHARE_TO_REMOVE;

    await saveProducts(tx, snapshots, input.now);
    await replaceVideos(tx, snapshots);
    await recordSalesDay(tx, snapshots, input.now);

    const removed = removalSkipped
      ? []
      : await tx
          .delete(product)
          .where(
            and(
              notInArray(
                product.id,
                snapshots.map((snapshot) => snapshot.id),
              ),
              or(
                inArray(product.categorySlug, [
                  ...new Set(
                    snapshots.map((snapshot) => snapshot.categorySlug),
                  ),
                ]),
                lt(
                  product.collectedAt,
                  new Date(
                    input.now.getTime() -
                      STALE_AFTER_DAYS * MILLISECONDS_PER_DAY,
                  ),
                ),
              ),
            ),
          )
          .returning({ id: product.id });

    return {
      saved: snapshots.length,
      skipped: raw.length - snapshots.length,
      removed: removed.length,
      removalSkipped,
    };
  });
}

import {
  and,
  count,
  eq,
  inArray,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { ad, product } from "@/db/schema";
import { MANUAL_SOURCE, todayInBrazil } from "@/features/ads/domain/ads";
import { recordRun } from "../record-run";
import { type AdSnapshot, type AdSource, adSnapshotSchema } from "./ad-source";

export interface AdCollectionResult {
  readonly saved: number;
  readonly skipped: number;
  /** Ads from this source that it no longer finds, now marked as stopped. */
  readonly stopped: number;
  /** True when the source returned far fewer ads than it had running, so none was stopped. */
  readonly stopSkipped: boolean;
}

export class EmptyAdSourceError extends Error {
  constructor(sourceName: string) {
    super(
      `Ad source "${sourceName}" returned no valid ads; nothing was changed.`,
    );
    this.name = "EmptyAdSourceError";
  }
}

/** "manual" belongs to ads added in the admin; a source with that name would stop them. */
export class ReservedAdSourceNameError extends Error {
  constructor() {
    super('An automatic ad source cannot be named "manual".');
    this.name = "ReservedAdSourceNameError";
  }
}

/** Below this share of the running ads, a response looks partial (e.g. a failed page). */
const MIN_SHARE_TO_STOP = 0.5;
/** Rows per statement: well under Postgres' 65,535-parameter limit for ~12 columns. */
const CHUNK_SIZE = 500;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function validSnapshots(raw: readonly unknown[]): AdSnapshot[] {
  return raw.flatMap((item) => {
    const parsed = adSnapshotSchema.safeParse(item);

    return parsed.success ? [parsed.data] : [];
  });
}

function chunk<T>(items: readonly T[]): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / CHUNK_SIZE) },
    (_, index) => items.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
}

/** Catalog products whose Shopee link is one an ad sends people to. */
async function productIdsByUrl(
  tx: Transaction,
  snapshots: readonly AdSnapshot[],
): Promise<Map<string, string>> {
  const urls = [
    ...new Set(snapshots.flatMap((snapshot) => snapshot.productUrl ?? [])),
  ];
  const found = new Map<string, string>();

  for (const part of chunk(urls)) {
    const rows = await tx
      .select({ id: product.id, url: product.productUrl })
      .from(product)
      .where(inArray(product.productUrl, part));

    for (const row of rows) found.set(row.url, row.id);
  }

  return found;
}

/** On conflict, curated ads keep what the admin wrote; facts about running always update. */
function keepCuratedOr(column: SQL.Aliased | SQL, excluded: string): SQL {
  return sql`case when ${ad.isCurated} then ${column} else ${sql.raw(`excluded."${excluded}"`)} end`;
}

const UPSERT_SET = {
  advertiserName: keepCuratedOr(sql`${ad.advertiserName}`, "advertiser_name"),
  adText: keepCuratedOr(sql`${ad.adText}`, "ad_text"),
  platforms: keepCuratedOr(sql`${ad.platforms}`, "platforms"),
  startedOn: keepCuratedOr(sql`${ad.startedOn}`, "started_on"),
  productId: keepCuratedOr(sql`${ad.productId}`, "product_id"),
  productUrl: keepCuratedOr(sql`${ad.productUrl}`, "product_url"),
  // Never goes back: an admin may have checked the ad after the day the source last saw it.
  lastSeenOn: sql`greatest(${ad.lastSeenOn}, excluded."last_seen_on")`,
  isActive: sql`excluded."is_active"`,
  updatedAt: sql`now()`,
};

function toRow(
  snapshot: AdSnapshot,
  sourceName: string,
  today: string,
  productIds: Map<string, string>,
) {
  return {
    libraryAdId: snapshot.libraryAdId,
    advertiserName: snapshot.advertiserName,
    adText: snapshot.adText,
    platforms: snapshot.platforms,
    startedOn: snapshot.startedOn,
    lastSeenOn: snapshot.stoppedOn ?? today,
    isActive: snapshot.stoppedOn == null,
    productUrl: snapshot.productUrl,
    productId:
      snapshot.productUrl == null
        ? null
        : (productIds.get(snapshot.productUrl) ?? null),
    source: sourceName,
    isCurated: false,
  };
}

async function stopMissingAds(
  tx: Transaction,
  sourceName: string,
  seenIds: readonly string[],
): Promise<number> {
  const stopped = await tx
    .update(ad)
    .set({ isActive: false })
    .where(
      and(
        eq(ad.source, sourceName),
        eq(ad.isActive, true),
        notInArray(ad.libraryAdId, [...seenIds]),
      ),
    )
    .returning({ id: ad.id });

  return stopped.length;
}

/**
 * Brings the ads of one automatic source up to date, in one transaction. New ads are added,
 * known ones get "seen today" (and new content, unless an admin curated them), and ads the
 * source no longer finds are marked as stopped, never deleted. Hidden ads stay hidden. A
 * response much smaller than what is running stops nothing; an empty one changes nothing.
 */
export async function collectAds(input: {
  db: Database;
  source: AdSource;
  today: string;
}): Promise<AdCollectionResult> {
  if (input.source.name === MANUAL_SOURCE)
    throw new ReservedAdSourceNameError();

  const raw = await input.source.fetchAds();
  const snapshots = validSnapshots(raw);

  if (snapshots.length === 0) throw new EmptyAdSourceError(input.source.name);

  return input.db.transaction(async (tx) => {
    const [running] = await tx
      .select({ total: count() })
      .from(ad)
      .where(and(eq(ad.source, input.source.name), eq(ad.isActive, true)));
    const stopSkipped =
      snapshots.length < (running?.total ?? 0) * MIN_SHARE_TO_STOP;
    const productIds = await productIdsByUrl(tx, snapshots);
    const rows = snapshots.map((snapshot) =>
      toRow(snapshot, input.source.name, input.today, productIds),
    );

    for (const part of chunk(rows)) {
      await tx
        .insert(ad)
        .values(part)
        .onConflictDoUpdate({ target: ad.libraryAdId, set: UPSERT_SET });
    }

    const stopped = stopSkipped
      ? 0
      : await stopMissingAds(
          tx,
          input.source.name,
          snapshots.map((snapshot) => snapshot.libraryAdId),
        );

    return {
      saved: snapshots.length,
      skipped: raw.length - snapshots.length,
      stopped,
      stopSkipped,
    };
  });
}

/** An ad collection, written down for the admin screen whether it worked or not. */
export async function collectAdsAndRecord(input: {
  db: Database;
  source: AdSource;
  clock?: () => Date;
}): Promise<AdCollectionResult> {
  return recordRun({
    db: input.db,
    kind: "ads",
    sourceName: input.source.name,
    clock: input.clock,
    run: (startedAt) =>
      collectAds({
        db: input.db,
        source: input.source,
        today: todayInBrazil(startedAt),
      }),
    counts: (result) => ({
      saved: result.saved,
      skipped: result.skipped,
      removed: result.stopped,
      removalSkipped: result.stopSkipped,
    }),
  });
}

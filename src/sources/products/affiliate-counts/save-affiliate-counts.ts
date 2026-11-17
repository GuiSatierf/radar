import { inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { product } from "@/db/schema";
import { scoreProduct } from "../product-score";
import type { AffiliateCount } from "./parse-affiliate-file";

/** Ids per lookup: well under Postgres' parameter limit. */
const CHUNK_SIZE = 500;

export interface SavedAffiliateCounts {
  readonly updated: number;
  /** Products in the file that are not in the Radar (removed, or never collected). */
  readonly unknown: number;
}

function chunk<T>(items: readonly T[]): T[][] {
  return Array.from(
    { length: Math.ceil(items.length / CHUNK_SIZE) },
    (_, index) => items.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );
}

/**
 * Writes each count on its product and recalculates the opportunity score, in one transaction.
 * Products the Radar does not have are counted and left alone, never created.
 */
export async function saveAffiliateCounts(
  db: Database,
  counts: readonly AffiliateCount[],
): Promise<SavedAffiliateCounts> {
  if (counts.length === 0) return { updated: 0, unknown: 0 };

  return db.transaction(async (tx) => {
    let updated = 0;

    for (const part of chunk(counts)) {
      const known = await tx
        .select({
          id: product.id,
          monthlySales: product.monthlySales,
          priceCents: product.priceCents,
          sellerRateBasisPoints: product.sellerRateBasisPoints,
        })
        .from(product)
        .where(
          inArray(
            product.id,
            part.map((count) => count.productId),
          ),
        );
      const knownById = new Map(known.map((row) => [row.id, row]));
      const values = part.flatMap((count) => {
        const row = knownById.get(count.productId);

        if (row == null) return [];

        const score = scoreProduct({
          ...row,
          affiliateCount: count.affiliateCount,
          affiliateCountIsMinimum: count.isMinimum,
        });

        return [
          sql`(${row.id}, ${count.affiliateCount}::integer, ${count.isMinimum}::boolean, ${score}::integer)`,
        ];
      });

      if (values.length === 0) continue;

      // One statement per chunk instead of one per product.
      await tx.execute(sql`
        update ${product}
        set affiliate_count = incoming.count,
            affiliate_count_is_minimum = incoming.is_minimum,
            opportunity_score = incoming.score
        from (values ${sql.join(values, sql`, `)}) as incoming(id, count, is_minimum, score)
        where ${product.id} = incoming.id
      `);
      updated += values.length;
    }

    return { updated, unknown: counts.length - updated };
  });
}

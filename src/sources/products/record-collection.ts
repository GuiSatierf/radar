import type { Database } from "@/db/client";
import { recordRun } from "../record-run";
import { type CollectionResult, collectProducts } from "./collect-products";
import type { ProductSource } from "./product-source";

/** A product collection, written down for the admin screen whether it worked or not. */
export async function collectAndRecord(input: {
  db: Database;
  source: ProductSource;
  clock?: () => Date;
}): Promise<CollectionResult> {
  return recordRun({
    db: input.db,
    kind: "products",
    sourceName: input.source.name,
    clock: input.clock,
    run: (startedAt) =>
      collectProducts({ db: input.db, source: input.source, now: startedAt }),
    counts: (result) => result,
  });
}

import type { Database } from "@/db/client";
import { collectionRun } from "@/db/schema";

export const COLLECTION_KINDS = ["products", "ads"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/** What the admin screen shows about a run; `removed` means "stopped" for ads. */
export interface RunCounts {
  readonly saved: number;
  readonly skipped: number;
  readonly removed: number;
  readonly removalSkipped: boolean;
}

const MAX_ERROR_LENGTH = 300;

function describeError(error: unknown): string {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return text.slice(0, MAX_ERROR_LENGTH);
}

/**
 * Runs a collection and writes down how it went, success or failure, for the admin screen.
 * A failure is still thrown after it is written, so the caller logs it and answers with an error.
 */
export async function recordRun<Result>(input: {
  db: Database;
  kind: CollectionKind;
  sourceName: string;
  clock?: () => Date;
  run: (startedAt: Date) => Promise<Result>;
  counts: (result: Result) => RunCounts;
}): Promise<Result> {
  const clock = input.clock ?? (() => new Date());
  const startedAt = clock();
  const base = { kind: input.kind, source: input.sourceName, startedAt };

  try {
    const result = await input.run(startedAt);
    await input.db.insert(collectionRun).values({
      ...base,
      ...input.counts(result),
      finishedAt: clock(),
      status: "ok",
    });

    return result;
  } catch (error) {
    await input.db.insert(collectionRun).values({
      ...base,
      finishedAt: clock(),
      status: "error",
      errorMessage: describeError(error),
    });

    throw error;
  }
}

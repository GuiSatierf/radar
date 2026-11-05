import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { videoProviderKey, videoSettings } from "@/db/schema";
import {
  DEFAULT_VIDEO_LIMIT,
  VIDEO_LIMIT_PERIODS,
  type VideoLimit,
} from "@/features/studio/domain/quota";
import { encryptVideoKey } from "./key-box";
import {
  findVideoModel,
  isVideoProviderId,
  type VideoProviderId,
} from "./providers";

const SETTINGS_ROW_ID = 1;

export interface ChosenVideoModel {
  readonly provider: VideoProviderId;
  readonly model: string;
}

export interface VideoSettings {
  readonly limit: VideoLimit;
  /** Null while the Studio makes the sample video. */
  readonly chosen: ChosenVideoModel | null;
}

function readLimit(count: number, period: string): VideoLimit {
  const known = VIDEO_LIMIT_PERIODS.find((id) => id === period);

  // A value the code no longer knows falls back to the default instead of breaking the Studio.
  if (known == null || Number.isSafeInteger(count) === false || count < 0)
    return DEFAULT_VIDEO_LIMIT;

  return { count, period: known };
}

function readChosen(
  provider: string | null,
  model: string | null,
): ChosenVideoModel | null {
  if (provider == null || model == null) return null;

  if (isVideoProviderId(provider) === false) return null;

  if (findVideoModel(provider, model) == null) return null;

  return { provider, model };
}

/** The admin's settings, or the defaults (20 videos a month, sample video) before any change. */
export async function getVideoSettings(db: Database): Promise<VideoSettings> {
  const [row] = await db
    .select({
      limitCount: videoSettings.limitCount,
      limitPeriod: videoSettings.limitPeriod,
      provider: videoSettings.provider,
      model: videoSettings.model,
    })
    .from(videoSettings)
    .where(eq(videoSettings.id, SETTINGS_ROW_ID));

  if (row == null) return { limit: DEFAULT_VIDEO_LIMIT, chosen: null };

  return {
    limit: readLimit(row.limitCount, row.limitPeriod),
    chosen: readChosen(row.provider, row.model),
  };
}

/** Saves how many videos each person makes per day, week or month. */
export async function saveVideoLimit(
  db: Database,
  limit: VideoLimit,
  now: Date,
): Promise<void> {
  const values = {
    limitCount: limit.count,
    limitPeriod: limit.period,
    updatedAt: now,
  };

  await db
    .insert(videoSettings)
    .values({ id: SETTINGS_ROW_ID, ...values })
    .onConflictDoUpdate({ target: videoSettings.id, set: values });
}

export interface SavedVideoKey {
  readonly provider: VideoProviderId;
  readonly updatedAt: Date;
}

/** Which services have a key saved; never the keys themselves. */
export async function listSavedVideoKeys(
  db: Database,
): Promise<SavedVideoKey[]> {
  const rows = await db
    .select({
      provider: videoProviderKey.provider,
      updatedAt: videoProviderKey.updatedAt,
    })
    .from(videoProviderKey)
    .orderBy(asc(videoProviderKey.provider));

  return rows.flatMap((row) =>
    isVideoProviderId(row.provider)
      ? [{ provider: row.provider, updatedAt: row.updatedAt }]
      : [],
  );
}

/** A service's key as stored (encrypted), or null when none is saved. */
export async function readVideoKeyCiphertext(
  db: Database,
  provider: VideoProviderId,
): Promise<string | null> {
  const [row] = await db
    .select({ keyCiphertext: videoProviderKey.keyCiphertext })
    .from(videoProviderKey)
    .where(eq(videoProviderKey.provider, provider));

  return row?.keyCiphertext ?? null;
}

/** Saves (or replaces) a service's key, encrypted with VIDEO_KEYS_SECRET. */
export async function saveVideoKey(
  db: Database,
  input: { provider: VideoProviderId; plainKey: string; secret: string },
  now: Date,
): Promise<void> {
  const values = {
    keyCiphertext: encryptVideoKey(input.plainKey, input.secret),
    updatedAt: now,
  };

  await db
    .insert(videoProviderKey)
    .values({ provider: input.provider, ...values })
    .onConflictDoUpdate({ target: videoProviderKey.provider, set: values });
}

/**
 * Removes a service's key. If that service was the one in use, the Studio goes back to the sample
 * video, so it never calls a service without a key.
 *
 * @returns False when there was no key to remove.
 */
export async function removeVideoKey(
  db: Database,
  provider: VideoProviderId,
  now: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(videoProviderKey)
      .where(eq(videoProviderKey.provider, provider))
      .returning({ provider: videoProviderKey.provider });

    await tx
      .update(videoSettings)
      .set({ provider: null, model: null, updatedAt: now })
      .where(
        and(
          eq(videoSettings.id, SETTINGS_ROW_ID),
          eq(videoSettings.provider, provider),
        ),
      );

    return removed.length > 0;
  });
}

export type ChooseModelResult =
  | { ok: true }
  | { ok: false; reason: "unknown-model" | "missing-key" };

/** Makes a model the one the Studio uses. Only a service with a saved key can be chosen. */
export async function chooseVideoModel(
  db: Database,
  chosen: { provider: VideoProviderId; model: string },
  now: Date,
): Promise<ChooseModelResult> {
  if (findVideoModel(chosen.provider, chosen.model) == null)
    return { ok: false, reason: "unknown-model" };

  const keys = await listSavedVideoKeys(db);

  if (keys.some((key) => key.provider === chosen.provider) === false)
    return { ok: false, reason: "missing-key" };

  const values = {
    provider: chosen.provider,
    model: chosen.model,
    updatedAt: now,
  };

  await db
    .insert(videoSettings)
    .values({
      id: SETTINGS_ROW_ID,
      limitCount: DEFAULT_VIDEO_LIMIT.count,
      limitPeriod: DEFAULT_VIDEO_LIMIT.period,
      ...values,
    })
    .onConflictDoUpdate({ target: videoSettings.id, set: values });

  return { ok: true };
}

/** Goes back to the sample video. */
export async function clearVideoModel(db: Database, now: Date): Promise<void> {
  await db
    .update(videoSettings)
    .set({ provider: null, model: null, updatedAt: now })
    .where(eq(videoSettings.id, SETTINGS_ROW_ID));
}

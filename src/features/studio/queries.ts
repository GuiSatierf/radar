import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { product, studioVideo } from "@/db/schema";
import type { CommissionProfile } from "@/features/radar/domain/commission";
import {
  COMPETITION_LABEL,
  classifyCompetition,
} from "@/features/radar/domain/competition";
import { parseRadarFilters } from "@/features/radar/filters";
import {
  listRadarProducts,
  type ProductCardData,
  toCard,
} from "@/features/radar/queries";
import { isVideoFormat, type VideoFormat } from "./domain/formats";
import type { VideoLimitPeriod } from "./domain/quota";
import { countVideosInPeriod } from "./queue";

// Caps the page. Videos last 15 days, so only a limit above 4 a day fills it; then the newest show.
const MAX_LIBRARY_VIDEOS = 60;

export type LibraryVideoStatus = "queued" | "generating" | "ready" | "failed";

const LIBRARY_STATUSES: readonly LibraryVideoStatus[] = [
  "queued",
  "generating",
  "ready",
  "failed",
];

export interface LibraryVideo {
  readonly id: string;
  readonly productName: string;
  readonly productImageUrl: string | null;
  readonly format: VideoFormat;
  readonly status: LibraryVideoStatus;
  readonly videoUrl: string | null;
  readonly createdAt: Date;
}

export interface StudioLibrary {
  readonly videos: readonly LibraryVideo[];
  /** Videos made in the current limit period. */
  readonly usedInPeriod: number;
  /** True while a video of this person is queued or being made: only one at a time. */
  readonly hasActiveVideo: boolean;
  /** When the queued or in-progress video was asked for, or null when there is none. */
  readonly activeVideoCreatedAt: Date | null;
}

function toLibraryStatus(status: string): LibraryVideoStatus | null {
  return LIBRARY_STATUSES.find((known) => known === status) ?? null;
}

/** The person's videos still in the library (newest first) and how many the current period used. */
export async function getStudioLibrary(input: {
  db: Database;
  userId: string;
  period: VideoLimitPeriod;
  now: Date;
}): Promise<StudioLibrary> {
  const [rows, usedInPeriod] = await Promise.all([
    input.db
      .select({
        id: studioVideo.id,
        productName: studioVideo.productName,
        productImageUrl: studioVideo.productImageUrl,
        format: studioVideo.format,
        status: studioVideo.status,
        videoUrl: studioVideo.videoUrl,
        createdAt: studioVideo.createdAt,
      })
      .from(studioVideo)
      .where(
        and(
          eq(studioVideo.userId, input.userId),
          ne(studioVideo.status, "expired"),
          // Hidden as soon as it expires, even before the scheduled task removes the link.
          or(
            isNull(studioVideo.expiresAt),
            gt(studioVideo.expiresAt, input.now),
          ),
        ),
      )
      .orderBy(desc(studioVideo.createdAt))
      .limit(MAX_LIBRARY_VIDEOS),
    countVideosInPeriod(input.db, input.userId, input.period, input.now),
  ]);
  const videos: LibraryVideo[] = [];

  for (const row of rows) {
    const status = toLibraryStatus(row.status);

    // A row the code does not know (renamed by hand in the database) is left out, not guessed.
    if (status == null || isVideoFormat(row.format) === false) continue;

    videos.push({ ...row, status, format: row.format });
  }

  const active = videos.find(
    (video) => video.status === "queued" || video.status === "generating",
  );

  return {
    videos,
    usedInPeriod,
    hasActiveVideo: active != null,
    activeVideoCreatedAt: active?.createdAt ?? null,
  };
}

export interface StudioProduct {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly earningsCents: number;
  /** "Concorrência baixa", or null while nobody has counted the affiliates. */
  readonly competitionLabel: string | null;
}

function toStudioProduct(card: ProductCardData): StudioProduct {
  const level = classifyCompetition(card);

  return {
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    earningsCents: card.earningsCents,
    competitionLabel:
      level === "sem-contagem" ? null : COMPETITION_LABEL[level],
  };
}

/** The product the person picked, with what they earn per sale; null when it left the catalog. */
export async function getStudioProduct(input: {
  db: Database;
  id: string;
  profile: CommissionProfile;
}): Promise<StudioProduct | null> {
  const [row] = await input.db
    .select()
    .from(product)
    .where(eq(product.id, input.id))
    .limit(1);

  if (row == null) return null;

  return toStudioProduct(toCard(row, input.profile));
}

/** The product list to pick from: the Radar's best opportunities, or a search by name. */
export async function listStudioProducts(input: {
  db: Database;
  search: string | null;
  profile: CommissionProfile;
}): Promise<StudioProduct[]> {
  const filters = parseRadarFilters({ busca: input.search ?? undefined });
  const { items } = await listRadarProducts({
    db: input.db,
    filters,
    profile: input.profile,
  });

  return items.map(toStudioProduct);
}

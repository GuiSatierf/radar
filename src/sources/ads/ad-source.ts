import { z } from "zod";
import { isAdPlatform, isCalendarDay } from "@/features/ads/domain/ads";

/**
 * The single seam between the app and wherever ads come from automatically (an automatic collector of the Meta
 * ad library or a paid supplier). Screens never see a source, only our `ad` table. Each source
 * maps its own format to this snapshot; the collector validates every item with Zod.
 */
const calendarDay = z.string().refine(isCalendarDay);

export const adSnapshotSchema = z.object({
  libraryAdId: z.string().regex(/^\d{5,30}$/),
  advertiserName: z.string().trim().min(1).max(100),
  adText: z.string().trim().max(2000).default(""),
  // Unknown platform names are dropped, not a reason to lose the ad.
  platforms: z
    .array(z.string())
    .default([])
    .transform((platforms) => [...new Set(platforms.filter(isAdPlatform))]),
  startedOn: calendarDay,
  // Null while the ad is running; the last day it ran once the source says it stopped.
  stoppedOn: calendarDay.nullable().default(null),
  // Where the ad sends people, when it is a Shopee product page (matched to our catalog).
  productUrl: z
    .url({ protocol: /^https$/ })
    .nullable()
    .default(null),
});

export type AdSnapshot = z.output<typeof adSnapshotSchema>;

export interface AdSource {
  /** Stored in `ad.source`; never "manual", which is the admin's. */
  readonly name: string;
  fetchAds(): Promise<readonly unknown[]>;
}

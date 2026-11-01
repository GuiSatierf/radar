import { getDatabase } from "@/db/client";
import { todayInBrazil } from "@/features/ads/domain/ads";
import { refuseUnauthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { collectAdsAndRecord } from "@/sources/ads/collect-ads";
import { createFakeAdSource } from "@/sources/ads/fake-ad-source";

// Only the demo source exists today; an automatic collector or a supplier plugs in here once the client decides.
export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorizedCron(request);

  if (refusal != null) return refusal;

  try {
    const result = await collectAdsAndRecord({
      db: getDatabase(),
      source: createFakeAdSource(todayInBrazil(new Date())),
    });
    logger.info({ ...result }, "ads collected");

    if (result.stopSkipped) {
      logger.warn(
        { ...result },
        "ad source returned far fewer ads; none was marked as stopped",
      );
    }

    return Response.json(result);
  } catch (error) {
    logger.error({ err: error }, "ad collection failed");

    return Response.json({ status: "error" }, { status: 500 });
  }
}

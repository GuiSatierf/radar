import { getDatabase } from "@/db/client";
import { refuseUnauthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { collectAdsAndRecord } from "@/sources/ads/collect-ads";
import { selectAdSource } from "@/sources/ads/select-ad-source";

export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorizedCron(request);

  if (refusal != null) return refusal;

  const source = selectAdSource();

  if (source == null) {
    logger.info("no automatic ad source configured; nothing collected");

    return Response.json({ status: "no-source" });
  }

  try {
    const result = await collectAdsAndRecord({ db: getDatabase(), source });
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

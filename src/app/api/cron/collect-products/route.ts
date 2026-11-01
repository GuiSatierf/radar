import { getDatabase } from "@/db/client";
import { refuseUnauthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { collectAndRecord } from "@/sources/products/record-collection";
import { selectProductSource } from "@/sources/products/select-product-source";

export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorizedCron(request);

  if (refusal != null) return refusal;

  try {
    const result = await collectAndRecord({
      db: getDatabase(),
      source: selectProductSource(process.env),
    });
    logger.info({ ...result }, "products collected");

    if (result.removalSkipped) {
      logger.warn(
        { ...result },
        "source returned far fewer products; nothing was removed",
      );
    }

    return Response.json(result);
  } catch (error) {
    logger.error({ err: error }, "product collection failed");

    return Response.json({ status: "error" }, { status: 500 });
  }
}

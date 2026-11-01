import { getDatabase } from "@/db/client";
import { applyEndedAccess } from "@/features/billing/access";
import { refuseUnauthorizedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

// Daily (Coolify scheduled task): subscriptions cancelled on Hotmart keep access until the end of
// the paid period; this removes it once that day has passed.
export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorizedCron(request);

  if (refusal != null) return refusal;

  try {
    const accounts = await applyEndedAccess(getDatabase(), new Date());
    logger.info({ accounts }, "ended access applied");

    return Response.json({ accounts });
  } catch (error) {
    logger.error({ err: error }, "ending access failed");

    return Response.json({ status: "error" }, { status: 500 });
  }
}

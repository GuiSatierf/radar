import { getDatabase } from "@/db/client";
import {
  getHotmartSettings,
  loadHotmartPlanMapping,
} from "@/features/billing/hotmart/settings";
import { handleHotmartWebhook } from "@/features/billing/hotmart/webhook";
import { logger } from "@/lib/logger";

// Called by Hotmart on each purchase event (docs/HOTMART.md). Until an admin saves the Hotmart
// code in the admin page, the route does not exist, so it can never run unprotected.
export async function POST(request: Request): Promise<Response> {
  try {
    const db = getDatabase();
    const settings = await getHotmartSettings(db);

    if (settings == null) return new Response(null, { status: 404 });

    const response = await handleHotmartWebhook({
      db,
      request,
      hottokHash: settings.hash,
      loadMapping: () => loadHotmartPlanMapping(db),
      unlocksPlans: settings.unlocksPlansAt != null,
      now: new Date(),
    });
    logger.info({ status: response.status }, "hotmart webhook handled");

    return response;
  } catch (error) {
    // A 5xx makes Hotmart send the event again later.
    logger.error({ err: error }, "hotmart webhook failed");

    return Response.json({ status: "error" }, { status: 500 });
  }
}

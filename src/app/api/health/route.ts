import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { logger } from "@/lib/logger";

// Used by the Coolify healthcheck: healthy only when the database answers.
export async function GET(): Promise<Response> {
  try {
    await getDatabase().execute(sql`select 1`);

    return Response.json({ status: "ok" });
  } catch (error) {
    logger.error({ err: error }, "healthcheck: database unavailable");

    return Response.json({ status: "error" }, { status: 503 });
  }
}

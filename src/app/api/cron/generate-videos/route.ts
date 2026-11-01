import { runVideoQueue } from "@/features/studio/run-queue";
import { refuseUnauthorizedCron } from "@/lib/cron-auth";

// Every minute (Coolify scheduled task): picks up videos a click did not finish (a deploy in
// between, for example) and takes expired videos out of the library.
export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorizedCron(request);

  if (refusal != null) return refusal;

  const isDone = await runVideoQueue();

  if (isDone === false) {
    return Response.json({ status: "error" }, { status: 500 });
  }

  return Response.json({ status: "ok" });
}

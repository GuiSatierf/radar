import { timingSafeEqual } from "node:crypto";

// Called by the Coolify scheduled tasks: POST with "Authorization: Bearer <CRON_SECRET>".
// Without CRON_SECRET the routes do not exist, so they can never run unprotected.
function isAuthorized(request: Request, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");

  if (received.length !== expected.length) return false;

  return timingSafeEqual(received, expected);
}

/** The refusal to send back (404 without a secret, 401 with a wrong one), or null when allowed. */
export function refuseUnauthorizedCron(request: Request): Response | null {
  // Trimmed: a pasted value often ends with a newline the scheduled task never sends.
  const secret = process.env.CRON_SECRET?.trim();

  if (secret == null || secret.length === 0) {
    return new Response(null, { status: 404 });
  }

  if (!isAuthorized(request, secret)) {
    return new Response(null, { status: 401 });
  }

  return null;
}

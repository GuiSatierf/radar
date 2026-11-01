import { timingSafeEqual } from "node:crypto";
import type { Database } from "@/db/client";
import { hotmartEvent } from "@/db/schema";
import { applyAccessChange, syncAccountPlan } from "../access";
import {
  type AccessChange,
  hotmartEnvelopeSchema,
  interpretHotmartEvent,
} from "./events";
import type { HotmartPlanMapping } from "./plan-mapping";
import { hashHottok } from "./settings";

export const HOTTOK_HEADER = "x-hotmart-hottok";

const RECORDED_ONLY = { outcome: "received", detail: null } as const;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;

/** Both sides are SHA-256 hex, so they always have the same length. */
function hasValidHottok(request: Request, hottokHash: string): boolean {
  const expected = Buffer.from(hottokHash);
  const received = Buffer.from(
    hashHottok(request.headers.get(HOTTOK_HEADER) ?? ""),
  );

  if (received.length !== expected.length) return false;

  return timingSafeEqual(received, expected);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    // Not JSON at all: answered as a bad request below, never applied.
    return null;
  }
}

function outcomeOf(change: AccessChange): {
  outcome: string;
  detail: string | null;
} {
  if (change.kind === "ignore")
    return { outcome: "ignored", detail: change.reason };

  return { outcome: "applied", detail: change.kind };
}

/**
 * One Hotmart notification: check it came from Hotmart, apply it once (Hotmart retries until it
 * gets a 2xx), and update the buyer's account. Ignored events still answer 200 so they stop.
 */
export async function handleHotmartWebhook(input: {
  db: Database;
  request: Request;
  hottokHash: string;
  // Read only after the request proved it came from Hotmart.
  loadMapping: () => Promise<HotmartPlanMapping>;
  unlocksPlans: boolean;
  now: Date;
}): Promise<Response> {
  if (!hasValidHottok(input.request, input.hottokHash)) {
    return new Response(null, { status: HTTP_UNAUTHORIZED });
  }

  const envelope = hotmartEnvelopeSchema.safeParse(
    await readJson(input.request),
  );

  if (!envelope.success) {
    return Response.json({ status: "invalid" }, { status: HTTP_BAD_REQUEST });
  }

  const change = interpretHotmartEvent(
    envelope.data,
    await input.loadMapping(),
  );
  // While plans are not unlocked automatically, an event is only recorded, never applied. An
  // event that would be ignored anyway keeps its reason, so a wrong mapping shows up now.
  const isRecordedOnly =
    input.unlocksPlans === false && change.kind !== "ignore";
  const toApply =
    input.unlocksPlans && change.kind !== "ignore" ? change : null;
  const { outcome, detail } = isRecordedOnly
    ? RECORDED_ONLY
    : outcomeOf(change);

  const isNew = await input.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(hotmartEvent)
      .values({
        id: envelope.data.id,
        event: envelope.data.event,
        outcome,
        detail,
      })
      .onConflictDoNothing()
      .returning({ id: hotmartEvent.id });

    if (inserted.length === 0) return false;

    if (toApply != null) {
      // Hotmart's clock may run a little ahead of ours: a refund stamped "in a second" must
      // still end the access now.
      const now = new Date(Math.max(input.now.getTime(), toApply.at.getTime()));
      await applyAccessChange(tx, toApply);
      await syncAccountPlan(tx, toApply.email, now);
    }

    return true;
  });

  if (!isNew) return Response.json({ status: "duplicate" });

  return Response.json({ status: outcome });
}

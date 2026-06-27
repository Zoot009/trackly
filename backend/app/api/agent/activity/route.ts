import { NextRequest } from "next/server";
import { activityBatchSchema } from "@flowace/shared";
import { requireAgent } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { ingestActivityBatch } from "@/services/activity";

export const dynamic = "force-dynamic";

/**
 * Bulk activity upload. Used both for realtime flushes and for syncing
 * SQLite-cached samples after the agent reconnects from offline.
 */
export const POST = handler(async (req: NextRequest) => {
  const agent = requireAgent(req);
  const body = activityBatchSchema.parse(await req.json());
  const result = await ingestActivityBatch(agent.employeeId, agent.sub, body);
  return ok(result);
});

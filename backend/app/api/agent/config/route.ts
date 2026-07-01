import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { buildAgentConfig } from "@/lib/agentConfig";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  requireAgent(req);
  return ok(await buildAgentConfig());
});

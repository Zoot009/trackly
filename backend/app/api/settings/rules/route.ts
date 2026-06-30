import { NextRequest } from "next/server";
import { productivityRuleSchema } from "@flowace/shared";
import { requireAdmin } from "@/lib/auth";
import { created, handler } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Create (or update) a productivity rule. Rules classify app/website usage as
 * productive / neutral / unproductive going forward. */
export const POST = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const body = productivityRuleSchema.parse(await req.json());

  // Make sure the global settings row exists (rules FK to it).
  await prisma.settings.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} });

  const rule = await prisma.productivityRule.upsert({
    where: { type_pattern: { type: body.type, pattern: body.pattern } },
    create: { settingsId: "global", pattern: body.pattern, type: body.type, productivity: body.productivity },
    update: { productivity: body.productivity },
  });
  return created(rule);
});

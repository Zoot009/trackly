import { NextRequest } from "next/server";
import { registerDeviceSchema } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { hashToken, signAgentToken } from "@/lib/auth";
import { created, fail, handler } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Agent enrollment. The agent presents the employee's enrollment token; we
 * create (or reuse) a Device row and issue a long-lived agent JWT.
 */
export const POST = handler(async (req: NextRequest) => {
  const body = registerDeviceSchema.parse(await req.json());

  const employee = await prisma.employee.findUnique({
    where: { enrollmentToken: body.enrollmentToken },
  });
  if (!employee || !employee.active) return fail("Invalid enrollment token", 401);

  const existing = await prisma.device.findFirst({
    where: { employeeId: employee.id, hostname: body.hostname },
  });

  const device = existing
    ? await prisma.device.update({
        where: { id: existing.id },
        data: {
          platform: body.platform,
          osVersion: body.osVersion ?? null,
          agentVersion: body.agentVersion,
          lastSeen: new Date(),
        },
      })
    : await prisma.device.create({
        data: {
          employeeId: employee.id,
          hostname: body.hostname,
          platform: body.platform,
          osVersion: body.osVersion ?? null,
          agentVersion: body.agentVersion,
          tokenHash: "",
        },
      });

  const token = signAgentToken({ sub: device.id, employeeId: employee.id, kind: "agent" });
  await prisma.device.update({ where: { id: device.id }, data: { tokenHash: hashToken(token) } });

  return created({
    token,
    deviceId: device.id,
    employeeId: employee.id,
    employeeName: employee.name,
  });
});

import { ActivityState, EmployeeStatus } from "@prisma/client";
import { extractDomain, type ActivityBatchInput } from "@flowace/shared";
import { prisma } from "../lib/prisma";
import { classify } from "../lib/productivity";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Ingest a batch of activity samples from an agent. Idempotent-ish: persists
 * raw logs and rolls them up into per-day application/website aggregates.
 * Used both for live samples and for offline-cached backfills.
 */
export async function ingestActivityBatch(
  employeeId: string,
  deviceId: string,
  input: ActivityBatchInput,
): Promise<{ inserted: number }> {
  const settings = await prisma.settings.findUnique({
    where: { id: "global" },
    include: { rules: true },
  });
  const rules = settings?.rules ?? [];

  await prisma.$transaction(async (tx) => {
    for (const s of input.samples) {
      const startedAt = new Date(s.startedAt);
      const endedAt = new Date(s.endedAt);
      const durationSec = Math.max(
        0,
        Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
      );

      await tx.activityLog.create({
        data: {
          employeeId,
          deviceId,
          state: s.state,
          appName: s.appName,
          windowTitle: s.windowTitle,
          website: s.website,
          keyboardCount: s.keyboardCount,
          mouseCount: s.mouseCount,
          idleSeconds: s.idleSeconds,
          startedAt,
          endedAt,
          durationSec,
        },
      });

      if (s.state !== ActivityState.ACTIVE || durationSec <= 0) continue;
      const day = startOfUtcDay(startedAt);

      if (s.appName) {
        const productivity = classify("APP", s.appName, rules);
        await tx.applicationUsage.upsert({
          where: {
            employeeId_appName_date: { employeeId, appName: s.appName, date: day },
          },
          create: { employeeId, appName: s.appName, productivity, totalSeconds: durationSec, date: day },
          update: { totalSeconds: { increment: durationSec }, productivity },
        });
      }

      const domain = extractDomain(s.website);
      if (domain) {
        const productivity = classify("WEBSITE", domain, rules);
        await tx.websiteUsage.upsert({
          where: {
            employeeId_domain_date: { employeeId, domain, date: day },
          },
          create: { employeeId, domain, productivity, totalSeconds: durationSec, date: day },
          update: { totalSeconds: { increment: durationSec }, productivity },
        });
      }
    }
  });

  return { inserted: input.samples.length };
}

/** Update an employee's denormalised live snapshot + status. */
export async function updateLiveSnapshot(
  employeeId: string,
  data: {
    status: EmployeeStatus;
    currentApp: string | null;
    currentWebsite: string | null;
    currentActivity: ActivityState | null;
    lastSeen: Date;
  },
): Promise<void> {
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      status: data.status,
      currentApp: data.currentApp,
      currentWebsite: data.currentWebsite,
      currentActivity: data.currentActivity,
      lastSeen: data.lastSeen,
    },
  });
}

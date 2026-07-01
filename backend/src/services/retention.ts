import { prisma } from "../lib/prisma";
import { pruneOldScreenshots } from "../lib/storage";

/**
 * Deletes data older than the configured retention window: screenshot files +
 * rows, raw activity logs, and the per-day usage aggregates. Runs on a daily
 * schedule (see server.ts) so the uploads volume and DB don't grow forever.
 */
export async function runRetentionCleanup(): Promise<{ screenshots: number; logs: number; usage: number }> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const days = settings?.dataRetentionDays ?? 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dayCutoff = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), cutoff.getUTCDate()));

  // Screenshots: remove files from disk first, then the DB rows.
  const oldShots = await prisma.screenshot.findMany({
    where: { capturedAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
  });
  if (oldShots.length > 0) {
    await pruneOldScreenshots(oldShots.map((s) => s.storageKey));
    await prisma.screenshot.deleteMany({ where: { id: { in: oldShots.map((s) => s.id) } } });
  }

  const logs = await prisma.activityLog.deleteMany({ where: { startedAt: { lt: cutoff } } });
  const appDel = await prisma.applicationUsage.deleteMany({ where: { date: { lt: dayCutoff } } });
  const webDel = await prisma.websiteUsage.deleteMany({ where: { date: { lt: dayCutoff } } });

  // Purge junk "website" rows captured from window titles (no real domain, e.g.
  // "portal", "settings") that predate the stricter extractDomain.
  await prisma.websiteUsage.deleteMany({ where: { NOT: { domain: { contains: "." } } } });

  return { screenshots: oldShots.length, logs: logs.count, usage: appDel.count + webDel.count };
}

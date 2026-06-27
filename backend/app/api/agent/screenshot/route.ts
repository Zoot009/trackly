import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth";
import { fail, handler, created } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { storeScreenshot } from "@/lib/storage";
import { emitLiveScreenshot } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Screenshot upload (multipart/form-data, field "file"). The agent already
 * compresses to WebP; we re-encode to enforce quality and generate a thumbnail.
 */
export const POST = handler(async (req: NextRequest) => {
  const agent = requireAgent(req);

  const form = await req.formData();
  const file = form.get("file");
  const capturedAtRaw = form.get("capturedAt");
  if (!(file instanceof File)) return fail("Missing screenshot file", 422);

  const capturedAt = capturedAtRaw ? new Date(String(capturedAtRaw)) : new Date();
  const buffer = Buffer.from(await file.arrayBuffer());

  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const quality = settings?.screenshotQuality ?? 70;

  const stored = await storeScreenshot(agent.employeeId, capturedAt, buffer, quality);

  const screenshot = await prisma.screenshot.create({
    data: {
      employeeId: agent.employeeId,
      deviceId: agent.sub,
      storageKey: stored.storageKey,
      url: stored.url,
      thumbnailUrl: stored.thumbnailUrl,
      width: stored.width,
      height: stored.height,
      sizeBytes: stored.sizeBytes,
      capturedAt,
    },
  });

  await prisma.employee.update({
    where: { id: agent.employeeId },
    data: { lastScreenshotUrl: stored.thumbnailUrl },
  });

  emitLiveScreenshot({
    employeeId: agent.employeeId,
    screenshotId: screenshot.id,
    url: stored.url,
    thumbnailUrl: stored.thumbnailUrl,
    capturedAt: capturedAt.toISOString(),
  });

  return created({ id: screenshot.id, url: stored.url, thumbnailUrl: stored.thumbnailUrl });
});

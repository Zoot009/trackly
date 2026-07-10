import path from "node:path";
import { promises as fs } from "node:fs";
import { app, desktopCapturer, screen } from "electron";
import { config } from "./config";
import { logger } from "./logger";
import { isScreenPrivate } from "./privacy";

/**
 * Captures the primary display as PNG and writes it to a temp directory. The
 * path is returned so the caller can queue it for upload.
 *
 * We deliberately do NOT compress to WebP in the agent: that requires sharp's
 * native libvips, which can hard-abort the process (an uncatchable native
 * assertion) on some machines. The backend re-encodes every upload to WebP, so
 * sending the raw PNG keeps the agent crash-proof at the cost of a larger
 * (but still bounded) upload.
 */
export async function captureScreenshot(): Promise<{ filePath: string; capturedAt: string } | null> {
  if (!config.get("monitoringEnabled")) return null;
  // Privacy: never capture while a private app (e.g. WhatsApp) is in focus.
  if (isScreenPrivate()) {
    logger.debug("Screenshot skipped (private app in focus)");
    return null;
  }

  try {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const scale = primary.scaleFactor || 1;

    // Cap the requested thumbnail size. Asking desktopCapturer for the FULL
    // physical resolution (width * scaleFactor) makes it return an EMPTY/black
    // frame on high-DPI / 4K Windows machines — the cause of "some users get no
    // screenshots". 1920px wide is proven to work and is plenty for monitoring.
    const MAX_WIDTH = 1920;
    const physW = Math.max(1, Math.round(width * scale));
    const physH = Math.max(1, Math.round(height * scale));
    const cap = physW > MAX_WIDTH ? MAX_WIDTH / physW : 1;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(physW * cap), height: Math.round(physH * cap) },
    });
    if (sources.length === 0) return null;

    // Never upload an empty capture (some machines/GPUs return a blank frame) —
    // the backend can't decode it and it just spams errors.
    const image = sources[0]!.thumbnail;
    if (image.isEmpty()) {
      logger.warn("Screenshot capture returned an empty frame — skipping");
      return null;
    }
    const png = image.toPNG();
    if (!png || png.length < 1000) {
      logger.warn(`Screenshot buffer too small (${png?.length ?? 0} bytes) — skipping`);
      return null;
    }

    const dir = path.join(app.getPath("temp"), "trackly-shots");
    await fs.mkdir(dir, { recursive: true });
    const capturedAt = new Date();
    const filePath = path.join(dir, `${capturedAt.getTime()}.png`);
    await fs.writeFile(filePath, png);

    return { filePath, capturedAt: capturedAt.toISOString() };
  } catch (err) {
    logger.warn("captureScreenshot failed", err);
    return null;
  }
}

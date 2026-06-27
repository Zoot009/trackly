import path from "node:path";
import { promises as fs } from "node:fs";
import { app, desktopCapturer, screen } from "electron";
import sharp from "sharp";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Captures the primary display, compresses to WebP and writes it to a temp
 * directory. The path is returned so the caller can queue it for upload.
 */
export async function captureScreenshot(): Promise<{ filePath: string; capturedAt: string } | null> {
  if (!config.get("monitoringEnabled")) return null;

  try {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const scale = primary.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
    });
    if (sources.length === 0) return null;

    const png = sources[0]!.thumbnail.toPNG();
    const quality = config.get("screenshotQuality");
    const webp = await sharp(png).webp({ quality }).toBuffer();

    const dir = path.join(app.getPath("temp"), "trackly-shots");
    await fs.mkdir(dir, { recursive: true });
    const capturedAt = new Date();
    const filePath = path.join(dir, `${capturedAt.getTime()}.webp`);
    await fs.writeFile(filePath, webp);

    return { filePath, capturedAt: capturedAt.toISOString() };
  } catch (err) {
    logger.warn("captureScreenshot failed", err);
    return null;
  }
}

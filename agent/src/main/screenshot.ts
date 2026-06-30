import path from "node:path";
import { promises as fs } from "node:fs";
import { app, desktopCapturer, screen } from "electron";
import { config } from "./config";
import { logger } from "./logger";

/**
 * sharp pulls in a native libvips binary that can fail to load on some machines
 * (missing system libs, packaging quirks). Load it lazily and tolerate failure:
 * if it's unavailable we send the raw PNG and let the backend re-encode, so a
 * sharp problem can never crash the agent.
 */
type Sharp = typeof import("sharp");
let sharpMod: Sharp | null | undefined;
function getSharp(): Sharp | null {
  if (sharpMod !== undefined) return sharpMod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpMod = require("sharp") as Sharp;
  } catch (err) {
    logger.warn("sharp unavailable; screenshots will be uploaded as PNG", err);
    sharpMod = null;
  }
  return sharpMod;
}

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

    // Prefer WebP (smaller upload); fall back to PNG if sharp can't load.
    const sharp = getSharp();
    let buffer: Buffer = png;
    let ext = "png";
    if (sharp) {
      try {
        buffer = await sharp(png).webp({ quality }).toBuffer();
        ext = "webp";
      } catch (err) {
        logger.warn("webp encode failed; uploading PNG", err);
      }
    }

    const dir = path.join(app.getPath("temp"), "trackly-shots");
    await fs.mkdir(dir, { recursive: true });
    const capturedAt = new Date();
    const filePath = path.join(dir, `${capturedAt.getTime()}.${ext}`);
    await fs.writeFile(filePath, buffer);

    return { filePath, capturedAt: capturedAt.toISOString() };
  } catch (err) {
    logger.warn("captureScreenshot failed", err);
    return null;
  }
}

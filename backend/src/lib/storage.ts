import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { screenshotKey } from "@flowace/shared";
import { env } from "./env";

export interface StoredScreenshot {
  storageKey: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Persist a screenshot to local VPS storage as WebP + a small WebP thumbnail.
 * Layout: /uploads/screenshots/{employeeId}/{year}/{month}/{ts}.webp
 */
export async function storeScreenshot(
  employeeId: string,
  capturedAt: Date,
  buffer: Buffer,
  quality: number,
): Promise<StoredScreenshot> {
  const key = screenshotKey(employeeId, capturedAt);
  const absPath = path.join(env.uploadsDir, key);
  const thumbKey = key.replace(/\.webp$/, ".thumb.webp");
  const thumbPath = path.join(env.uploadsDir, thumbKey);

  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const image = sharp(buffer);
  const meta = await image.metadata();

  const full = await image
    .webp({ quality: Math.min(100, Math.max(1, quality)) })
    .toBuffer();
  await fs.writeFile(absPath, full);

  await sharp(buffer)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 60 })
    .toFile(thumbPath);

  return {
    storageKey: key,
    url: `${env.publicBaseUrl}/uploads/screenshots/${key}`,
    thumbnailUrl: `${env.publicBaseUrl}/uploads/screenshots/${thumbKey}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sizeBytes: full.byteLength,
  };
}

/** Delete screenshots older than the retention window. Returns count removed. */
export async function pruneOldScreenshots(beforeKeys: string[]): Promise<number> {
  let removed = 0;
  for (const key of beforeKeys) {
    const abs = path.join(env.uploadsDir, key);
    const thumb = abs.replace(/\.webp$/, ".thumb.webp");
    await fs.rm(abs, { force: true });
    await fs.rm(thumb, { force: true });
    removed++;
  }
  return removed;
}

import { existsSync, promises as fs } from "node:fs";
import type { ActivityBatchInput } from "@flowace/shared";
import { config } from "./config";
import {
  markSamplesSynced,
  markScreenshotSynced,
  pendingSamples,
  pendingScreenshots,
} from "./db";
import { uploadActivity, uploadScreenshot } from "./api";
import { logger } from "./logger";

/**
 * Drains the local SQLite queues to the backend. Runs on an interval and also
 * on demand (e.g. right after reconnect). Safe to call concurrently — guarded
 * by an in-flight flag.
 */
export class SyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = 60_000): void {
    this.timer = setInterval(() => void this.flush(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.flushSamples();
      await this.flushScreenshots();
    } finally {
      this.running = false;
    }
  }

  private async flushSamples(): Promise<void> {
    const deviceId = config.get("deviceId");
    if (!deviceId) return;

    // Loop until the queue is empty or an upload fails.
    for (;;) {
      const rows = pendingSamples(200);
      if (rows.length === 0) break;

      const batch: ActivityBatchInput = {
        deviceId,
        samples: rows.map((r) => ({
          state: r.state,
          appName: r.appName,
          windowTitle: r.windowTitle,
          website: r.website,
          keyboardCount: r.keyboardCount,
          mouseCount: r.mouseCount,
          idleSeconds: r.idleSeconds,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
        })),
      };

      const ok = await uploadActivity(batch);
      if (!ok) {
        logger.debug("Sample flush deferred (offline)");
        break;
      }
      markSamplesSynced(rows.map((r) => r.id));
      logger.info(`Synced ${rows.length} samples`);
      if (rows.length < 200) break;
    }
  }

  private async flushScreenshots(): Promise<void> {
    const rows = pendingScreenshots(20);
    for (const row of rows) {
      // The temp file can vanish — Windows clears %TEMP%, or the agent was
      // reinstalled while rows stayed queued in the cache DB. That is permanent, so
      // drop the row instead of retrying it forever: uploadScreenshot returns false
      // for a missing file exactly like it does for a network failure, and the
      // `break` below would then block every screenshot queued behind it.
      if (!existsSync(row.filePath)) {
        markScreenshotSynced(row.id);
        logger.warn(`Screenshot file gone, dropped from queue: ${row.filePath}`);
        continue;
      }
      const ok = await uploadScreenshot(row.filePath, row.capturedAt);
      if (!ok) break; // transient (offline/server) — retry on the next cycle
      markScreenshotSynced(row.id);
      await fs.rm(row.filePath, { force: true }).catch(() => {});
      logger.info("Synced screenshot");
    }
  }
}

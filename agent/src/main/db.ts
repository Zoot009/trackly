import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import type { ActivityState } from "@flowace/shared";
import { logger } from "./logger";

/**
 * Local SQLite cache. Activity samples and pending screenshots are written here
 * first so the agent works fully offline; a sync worker drains the queues when
 * connectivity returns.
 */

export interface CachedSample {
  id: number;
  state: ActivityState;
  appName: string | null;
  windowTitle: string | null;
  website: string | null;
  keyboardCount: number;
  mouseCount: number;
  idleSeconds: number;
  startedAt: string;
  endedAt: string;
}

let db: Database.Database;

export function initDb(): void {
  const file = path.join(app.getPath("userData"), "trackly-cache.db");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state TEXT NOT NULL,
      appName TEXT,
      windowTitle TEXT,
      website TEXT,
      keyboardCount INTEGER NOT NULL DEFAULT 0,
      mouseCount INTEGER NOT NULL DEFAULT 0,
      idleSeconds INTEGER NOT NULL DEFAULT 0,
      startedAt TEXT NOT NULL,
      endedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filePath TEXT NOT NULL,
      capturedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);
  logger.info(`SQLite cache ready at ${file}`);
}

export function insertSample(sample: Omit<CachedSample, "id">): void {
  db.prepare(
    `INSERT INTO samples (state, appName, windowTitle, website, keyboardCount, mouseCount, idleSeconds, startedAt, endedAt)
     VALUES (@state, @appName, @windowTitle, @website, @keyboardCount, @mouseCount, @idleSeconds, @startedAt, @endedAt)`,
  ).run(sample);
}

export function pendingSamples(limit = 200): CachedSample[] {
  return db
    .prepare(`SELECT * FROM samples WHERE synced = 0 ORDER BY id ASC LIMIT ?`)
    .all(limit) as CachedSample[];
}

export function markSamplesSynced(ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE samples SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
  // Vacuum old synced rows to keep the cache small.
  db.prepare(`DELETE FROM samples WHERE synced = 1 AND id < (SELECT MAX(id) - 5000 FROM samples)`).run();
}

export function insertScreenshot(filePath: string, capturedAt: string): void {
  db.prepare(`INSERT INTO screenshots (filePath, capturedAt) VALUES (?, ?)`).run(filePath, capturedAt);
}

export function pendingScreenshots(limit = 20): { id: number; filePath: string; capturedAt: string }[] {
  return db
    .prepare(`SELECT id, filePath, capturedAt FROM screenshots WHERE synced = 0 ORDER BY id ASC LIMIT ?`)
    .all(limit) as { id: number; filePath: string; capturedAt: string }[];
}

export function markScreenshotSynced(id: number): void {
  db.prepare(`UPDATE screenshots SET synced = 1 WHERE id = ?`).run(id);
}

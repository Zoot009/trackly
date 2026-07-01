-- Private apps: foreground apps for which screenshots are skipped and live view
-- is blacked out (privacy).
ALTER TABLE "settings" ADD COLUMN "privateApps" TEXT[] NOT NULL DEFAULT '{}';

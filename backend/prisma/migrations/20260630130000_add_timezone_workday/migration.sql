-- Add timezone for workday scoping.
ALTER TABLE "settings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Workday scoping is now opt-in: default to the whole day so existing behaviour
-- is unchanged until an admin sets a real window. (The old 09:00-18:00 default
-- was never applied.)
ALTER TABLE "settings" ALTER COLUMN "workdayStart" SET DEFAULT '00:00';
ALTER TABLE "settings" ALTER COLUMN "workdayEnd" SET DEFAULT '23:59';
UPDATE "settings" SET "workdayStart" = '00:00', "workdayEnd" = '23:59';

-- Workday is now an attendance reference only (it no longer clips work totals),
-- so default it to a normal 09:00-18:00 shift.
ALTER TABLE "settings" ALTER COLUMN "workdayStart" SET DEFAULT '09:00';
ALTER TABLE "settings" ALTER COLUMN "workdayEnd" SET DEFAULT '18:00';
UPDATE "settings" SET "workdayStart" = '09:00', "workdayEnd" = '18:00'
WHERE "workdayStart" = '00:00' AND "workdayEnd" = '23:59';

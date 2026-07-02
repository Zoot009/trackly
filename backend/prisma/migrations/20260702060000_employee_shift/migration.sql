-- Per-employee shift (local HH:mm). Overnight when shiftEnd <= shiftStart.
ALTER TABLE "employees" ADD COLUMN "shiftStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "employees" ADD COLUMN "shiftEnd" TEXT NOT NULL DEFAULT '18:00';

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ONLINE', 'OFFLINE', 'IDLE');

-- CreateEnum
CREATE TYPE "ActivityState" AS ENUM ('ACTIVE', 'IDLE');

-- CreateEnum
CREATE TYPE "Productivity" AS ENUM ('PRODUCTIVE', 'UNPRODUCTIVE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('APP', 'WEBSITE');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "jobTitle" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeen" TIMESTAMP(3),
    "currentApp" TEXT,
    "currentWebsite" TEXT,
    "currentActivity" "ActivityState",
    "lastScreenshotUrl" TEXT,
    "enrollmentToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "osVersion" TEXT,
    "agentVersion" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "state" "ActivityState" NOT NULL,
    "appName" TEXT,
    "windowTitle" TEXT,
    "website" TEXT,
    "keyboardCount" INTEGER NOT NULL DEFAULT 0,
    "mouseCount" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_usage" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "productivity" "Productivity" NOT NULL DEFAULT 'NEUTRAL',
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,

    CONSTRAINT "application_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_usage" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "productivity" "Productivity" NOT NULL DEFAULT 'NEUTRAL',
    "totalSeconds" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,

    CONSTRAINT "website_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "screenshotIntervalSec" INTEGER NOT NULL DEFAULT 300,
    "idleTimeoutSec" INTEGER NOT NULL DEFAULT 180,
    "screenshotQuality" INTEGER NOT NULL DEFAULT 70,
    "workdayStart" TEXT NOT NULL DEFAULT '09:00',
    "workdayEnd" TEXT NOT NULL DEFAULT '18:00',
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productivity_rules" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL DEFAULT 'global',
    "pattern" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "productivity" "Productivity" NOT NULL,

    CONSTRAINT "productivity_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_enrollmentToken_key" ON "employees"("enrollmentToken");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "devices_employeeId_idx" ON "devices"("employeeId");

-- CreateIndex
CREATE INDEX "sessions_employeeId_startedAt_idx" ON "sessions"("employeeId", "startedAt");

-- CreateIndex
CREATE INDEX "activity_logs_employeeId_startedAt_idx" ON "activity_logs"("employeeId", "startedAt");

-- CreateIndex
CREATE INDEX "activity_logs_appName_idx" ON "activity_logs"("appName");

-- CreateIndex
CREATE INDEX "application_usage_date_idx" ON "application_usage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "application_usage_employeeId_appName_date_key" ON "application_usage"("employeeId", "appName", "date");

-- CreateIndex
CREATE INDEX "website_usage_date_idx" ON "website_usage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "website_usage_employeeId_domain_date_key" ON "website_usage"("employeeId", "domain", "date");

-- CreateIndex
CREATE INDEX "screenshots_employeeId_capturedAt_idx" ON "screenshots"("employeeId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "productivity_rules_type_pattern_key" ON "productivity_rules"("type", "pattern");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_usage" ADD CONSTRAINT "application_usage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_usage" ADD CONSTRAINT "website_usage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_rules" ADD CONSTRAINT "productivity_rules_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

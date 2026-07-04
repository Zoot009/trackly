-- Ghost agents: snapshot of an agent whose employee was deleted but which may
-- still be installed and phoning home. Surfaces "removed but still reporting"
-- machines so they get uninstalled.
CREATE TABLE "ghost_agents" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeEmail" TEXT,
    "hostname" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "agentVersion" TEXT,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ghost_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ghost_agents_deviceId_key" ON "ghost_agents"("deviceId");

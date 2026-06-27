import { PrismaClient, Productivity, EmployeeStatus, ActivityState } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = ["Engineering", "Sales", "Support", "Design", "Marketing"];
const APPS = [
  { name: "Visual Studio Code", p: Productivity.PRODUCTIVE },
  { name: "Slack", p: Productivity.NEUTRAL },
  { name: "Google Chrome", p: Productivity.NEUTRAL },
  { name: "Figma", p: Productivity.PRODUCTIVE },
  { name: "YouTube", p: Productivity.UNPRODUCTIVE },
  { name: "Notion", p: Productivity.PRODUCTIVE },
];
const SITES = [
  { domain: "github.com", p: Productivity.PRODUCTIVE },
  { domain: "stackoverflow.com", p: Productivity.PRODUCTIVE },
  { domain: "youtube.com", p: Productivity.UNPRODUCTIVE },
  { domain: "linear.app", p: Productivity.PRODUCTIVE },
  { domain: "twitter.com", p: Productivity.UNPRODUCTIVE },
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

async function main() {
  console.log("Seeding Flowace…");

  const password = await bcrypt.hash("admin12345", 12);
  await prisma.admin.upsert({
    where: { email: "admin@flowace.dev" },
    create: { email: "admin@flowace.dev", name: "Admin", password, role: "SUPER_ADMIN" },
    update: { password },
  });

  await prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  // Seed productivity rules.
  for (const a of APPS) {
    await prisma.productivityRule.upsert({
      where: { type_pattern: { type: "APP", pattern: a.name } },
      create: { type: "APP", pattern: a.name, productivity: a.p },
      update: { productivity: a.p },
    });
  }
  for (const s of SITES) {
    await prisma.productivityRule.upsert({
      where: { type_pattern: { type: "WEBSITE", pattern: s.domain } },
      create: { type: "WEBSITE", pattern: s.domain, productivity: s.p },
      update: { productivity: s.p },
    });
  }

  const statuses = [EmployeeStatus.ONLINE, EmployeeStatus.IDLE, EmployeeStatus.OFFLINE];
  const today = new Date();
  const day0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  for (let i = 0; i < 12; i++) {
    const app = pick(APPS, i);
    const status = pick(statuses, i);
    const employee = await prisma.employee.upsert({
      where: { email: `employee${i + 1}@flowace.dev` },
      create: {
        name: `Employee ${i + 1}`,
        email: `employee${i + 1}@flowace.dev`,
        department: pick(DEPARTMENTS, i),
        jobTitle: "Team Member",
        status,
        lastSeen: new Date(),
        currentApp: app.name,
        currentWebsite: pick(SITES, i).domain,
        currentActivity: status === EmployeeStatus.IDLE ? ActivityState.IDLE : ActivityState.ACTIVE,
      },
      update: { status, active: true },
    });

    // A device for this employee (required for activity logs). Idempotent.
    const existingDevice = await prisma.device.findFirst({
      where: { employeeId: employee.id, hostname: `desktop-${i + 1}` },
    });
    const device =
      existingDevice ??
      (await prisma.device.create({
        data: {
          employeeId: employee.id,
          hostname: `desktop-${i + 1}`,
          platform: i % 2 === 0 ? "win32" : "darwin",
          osVersion: "10.0.0",
          agentVersion: "1.0.0",
          tokenHash: "seed",
        },
      }));

    // Reset this employee's activity logs so re-seeding stays idempotent.
    await prisma.activityLog.deleteMany({ where: { employeeId: employee.id } });

    // Daily usage aggregates + raw activity logs for the past week.
    for (let d = 0; d < 7; d++) {
      const date = new Date(day0);
      date.setUTCDate(day0.getUTCDate() - d);
      const a = pick(APPS, i + d);
      const s = pick(SITES, i + d);

      const workedSec = 3600 * (4 + (i % 4)); // 4–7h
      const idleSec = 1800 * (1 + (i % 3)); // 0.5–1.5h

      await prisma.applicationUsage.upsert({
        where: { employeeId_appName_date: { employeeId: employee.id, appName: a.name, date } },
        create: { employeeId: employee.id, appName: a.name, productivity: a.p, totalSeconds: workedSec, date },
        update: { totalSeconds: workedSec, productivity: a.p },
      });
      await prisma.websiteUsage.upsert({
        where: { employeeId_domain_date: { employeeId: employee.id, domain: s.domain, date } },
        create: { employeeId: employee.id, domain: s.domain, productivity: s.p, totalSeconds: idleSec, date },
        update: { totalSeconds: idleSec, productivity: s.p },
      });

      // ACTIVE block starting 09:00 UTC, then an IDLE block after it.
      const activeStart = new Date(date);
      activeStart.setUTCHours(9, 0, 0, 0);
      const activeEnd = new Date(activeStart.getTime() + workedSec * 1000);
      const idleEnd = new Date(activeEnd.getTime() + idleSec * 1000);

      await prisma.activityLog.createMany({
        data: [
          {
            employeeId: employee.id,
            deviceId: device.id,
            state: ActivityState.ACTIVE,
            appName: a.name,
            windowTitle: `${a.name} — working`,
            website: s.domain,
            keyboardCount: 1200 + i * 30,
            mouseCount: 800 + i * 20,
            idleSeconds: 0,
            startedAt: activeStart,
            endedAt: activeEnd,
            durationSec: workedSec,
          },
          {
            employeeId: employee.id,
            deviceId: device.id,
            state: ActivityState.IDLE,
            appName: a.name,
            windowTitle: null,
            website: null,
            keyboardCount: 0,
            mouseCount: 0,
            idleSeconds: idleSec,
            startedAt: activeEnd,
            endedAt: idleEnd,
            durationSec: idleSec,
          },
        ],
      });
    }
  }

  console.log("Seed complete. Login: admin@flowace.dev / admin12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

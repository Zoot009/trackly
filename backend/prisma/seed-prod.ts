import { PrismaClient, Productivity } from "@prisma/client";

/**
 * Production bootstrap for a FRESH database: the admin account, the global
 * settings row and the default productivity rules — and nothing else.
 *
 * Unlike seed.ts (development), this creates no demo employees, devices or
 * activity logs, so it is safe to run against a live database. Re-running it
 * never overwrites an existing admin's password.
 *
 *   SEED_ADMIN_EMAIL=you@company.com \
 *   SEED_ADMIN_PASSWORD='your-password' \
 *   npm run seed:prod --workspace backend
 */

const prisma = new PrismaClient();

const APPS: [string, Productivity][] = [
  ["Visual Studio Code", Productivity.PRODUCTIVE],
  ["Slack", Productivity.NEUTRAL],
  ["Google Chrome", Productivity.NEUTRAL],
  ["Microsoft Edge", Productivity.NEUTRAL],
  ["Figma", Productivity.PRODUCTIVE],
  ["Notion", Productivity.PRODUCTIVE],
  ["YouTube", Productivity.UNPRODUCTIVE],
];

const SITES: [string, Productivity][] = [
  ["github.com", Productivity.PRODUCTIVE],
  ["stackoverflow.com", Productivity.PRODUCTIVE],
  ["linear.app", Productivity.PRODUCTIVE],
  ["docs.google.com", Productivity.PRODUCTIVE],
  ["youtube.com", Productivity.UNPRODUCTIVE],
  ["twitter.com", Productivity.UNPRODUCTIVE],
  ["instagram.com", Productivity.UNPRODUCTIVE],
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";

  if (!email || !password) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the production seed.",
    );
  }
  // The login form rejects anything shorter, so refuse to create an account
  // that could never be used to sign in.
  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  // Stored as plain text — see backend/src/lib/auth.ts. `update: {}` means a
  // re-run never resets a password changed from the profile page.
  const admin = await prisma.admin.upsert({
    where: { email },
    create: { email, name, password, role: "SUPER_ADMIN" },
    update: {},
  });
  console.log(`Admin ready: ${admin.email}`);

  await prisma.settings.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} });
  console.log("Global settings ready");

  for (const [pattern, productivity] of APPS) {
    await prisma.productivityRule.upsert({
      where: { type_pattern: { type: "APP", pattern } },
      create: { type: "APP", pattern, productivity },
      update: {},
    });
  }
  for (const [pattern, productivity] of SITES) {
    await prisma.productivityRule.upsert({
      where: { type_pattern: { type: "WEBSITE", pattern } },
      create: { type: "WEBSITE", pattern, productivity },
      update: {},
    });
  }
  console.log(`Productivity rules ready: ${APPS.length} apps, ${SITES.length} websites`);

  const employees = await prisma.employee.count();
  console.log(`\nDone. Employees in database: ${employees}. Sign in as ${admin.email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

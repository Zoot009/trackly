import type { Productivity, RuleType } from "@prisma/client";
import { prisma } from "./prisma";
import { classify } from "./productivity";

/** Load the current productivity rules once, for read-time classification.
 * Classifying at read time (rather than trusting the productivity stored on
 * usage rows at ingest) keeps every view consistent with the latest rules. */
export async function getRules() {
  const rows = await prisma.productivityRule.findMany({ where: { settingsId: "global" } });
  return rows.map((r) => ({ pattern: r.pattern, type: r.type, productivity: r.productivity }));
}

export type Rules = Awaited<ReturnType<typeof getRules>>;

export const classifyApp = (name: string, rules: Rules): Productivity =>
  classify("APP" as RuleType, name, rules);
export const classifyDomain = (domain: string, rules: Rules): Productivity =>
  classify("WEBSITE" as RuleType, domain, rules);

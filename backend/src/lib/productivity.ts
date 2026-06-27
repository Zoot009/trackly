import { Productivity, type RuleType } from "@prisma/client";

interface Rule {
  pattern: string;
  type: RuleType;
  productivity: Productivity;
}

/** Glob-ish match: case-insensitive substring or wildcard pattern. */
function matches(pattern: string, value: string): boolean {
  const p = pattern.toLowerCase();
  const v = value.toLowerCase();
  if (p.includes("*")) {
    const regex = new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return regex.test(v);
  }
  return v.includes(p);
}

/** Classify an app or website against the configured productivity rules. */
export function classify(
  type: RuleType,
  value: string,
  rules: Rule[],
): Productivity {
  for (const rule of rules) {
    if (rule.type === type && matches(rule.pattern, value)) {
      return rule.productivity;
    }
  }
  return Productivity.NEUTRAL;
}

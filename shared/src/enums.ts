/**
 * Shared enumerations used across the agent, backend and dashboard.
 * Keep these in sync with the Prisma schema (backend/prisma/schema.prisma).
 */

export enum EmployeeStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  IDLE = "IDLE",
}

export enum ActivityState {
  ACTIVE = "ACTIVE",
  IDLE = "IDLE",
}

/** How a category contributes to productivity scoring. */
export enum Productivity {
  PRODUCTIVE = "PRODUCTIVE",
  UNPRODUCTIVE = "UNPRODUCTIVE",
  NEUTRAL = "NEUTRAL",
}

export enum ReportType {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export enum UserRole {
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

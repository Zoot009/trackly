import type {
  ActivityState,
  EmployeeStatus,
  Productivity,
  ReportType,
  UserRole,
} from "./enums";

/** Domain types shared across apps. These mirror the Prisma models but are
 * decoupled so the dashboard does not need to import the Prisma client. */

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  status: EmployeeStatus;
  lastSeen: string | null;
  createdAt: string;

  // Live snapshot (denormalised for fast dashboard reads)
  currentApp: string | null;
  currentWebsite: string | null;
  currentActivity: ActivityState | null;
  todayWorkedSeconds: number;
  todayIdleSeconds: number;
  lastScreenshotUrl: string | null;
}

export interface Device {
  id: string;
  employeeId: string;
  hostname: string;
  platform: string;
  osVersion: string | null;
  agentVersion: string;
  lastSeen: string | null;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  employeeId: string;
  deviceId: string;
  state: ActivityState;
  appName: string | null;
  windowTitle: string | null;
  website: string | null;
  keyboardCount: number;
  mouseCount: number;
  idleSeconds: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
}

export interface ApplicationUsage {
  id: string;
  employeeId: string;
  appName: string;
  productivity: Productivity;
  totalSeconds: number;
  date: string;
}

export interface WebsiteUsage {
  id: string;
  employeeId: string;
  domain: string;
  productivity: Productivity;
  totalSeconds: number;
  date: string;
}

export interface Screenshot {
  id: string;
  employeeId: string;
  deviceId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  capturedAt: string;
}

export interface AppSettings {
  id: string;
  screenshotIntervalSec: number;
  idleTimeoutSec: number;
  screenshotQuality: number;
  workdayStart: string; // "09:00"
  workdayEnd: string; // "18:00"
  dataRetentionDays: number;
  monitoringEnabled: boolean;
  productivityRules: ProductivityRule[];
}

export interface ProductivityRule {
  id: string;
  pattern: string; // app name or domain glob
  type: "APP" | "WEBSITE";
  productivity: Productivity;
}

/* ---------- Dashboard read models ---------- */

export interface DashboardStats {
  totalEmployees: number;
  onlineEmployees: number;
  offlineEmployees: number;
  activeEmployees: number;
  idleEmployees: number;
  totalHoursToday: number;
  productivePercent: number;
  unproductivePercent: number;
  neutralPercent: number;
}

export interface ReportSummary {
  type: ReportType;
  rangeStart: string;
  rangeEnd: string;
  employeeId: string | null;
  workedSeconds: number;
  idleSeconds: number;
  productiveSeconds: number;
  unproductiveSeconds: number;
  topApps: { name: string; seconds: number; productivity: Productivity }[];
  topWebsites: { domain: string; seconds: number; productivity: Productivity }[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

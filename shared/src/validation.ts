import { z } from "zod";
import { ActivityState, Productivity } from "./enums";

/** Zod schemas shared by the backend (request validation) and the dashboard
 * (form validation via React Hook Form). */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  department: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial();
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/** Agent device registration. */
export const registerDeviceSchema = z.object({
  enrollmentToken: z.string().min(10),
  hostname: z.string().min(1),
  platform: z.string().min(1),
  osVersion: z.string().optional().nullable(),
  agentVersion: z.string().min(1),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

/** A batch of activity samples uploaded by the agent (supports offline sync). */
export const activityBatchSchema = z.object({
  deviceId: z.string().min(1),
  samples: z
    .array(
      z.object({
        state: z.nativeEnum(ActivityState),
        appName: z.string().nullable(),
        windowTitle: z.string().nullable(),
        website: z.string().nullable(),
        keyboardCount: z.number().int().min(0),
        mouseCount: z.number().int().min(0),
        idleSeconds: z.number().int().min(0),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(500),
});
export type ActivityBatchInput = z.infer<typeof activityBatchSchema>;

export const settingsSchema = z.object({
  screenshotIntervalSec: z.number().int().min(30).max(3600),
  idleTimeoutSec: z.number().int().min(30).max(3600),
  screenshotQuality: z.number().int().min(1).max(100),
  workdayStart: z.string().regex(/^\d{2}:\d{2}$/),
  workdayEnd: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1),
  dataRetentionDays: z.number().int().min(1).max(3650),
  monitoringEnabled: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const productivityRuleSchema = z.object({
  pattern: z.string().min(1),
  type: z.enum(["APP", "WEBSITE"]),
  productivity: z.nativeEnum(Productivity),
});
export type ProductivityRuleInput = z.infer<typeof productivityRuleSchema>;

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DashboardStats,
  Employee,
  Paginated,
  ReportSummary,
  AppSettings,
  CreateEmployeeInput,
} from "@flowace/shared";
import { apiClient } from "@/lib/api";

export interface ScreenshotRow {
  id: string;
  employeeId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  capturedAt: string;
  employee: { name: string; department: string | null };
}

export interface AnalyticsResponse {
  topApps: { name: string; seconds: number; productivity: string }[];
  topWebsites: { domain: string; seconds: number; productivity: string }[];
  activeByDay: { day: string; activeHours: number; idleHours: number }[];
  productivity: { PRODUCTIVE: number; UNPRODUCTIVE: number; NEUTRAL: number };
}

export interface EmployeeStatsResponse {
  date: string;
  summary: {
    workedSeconds: number;
    idleSeconds: number;
    productiveSeconds: number;
    unproductiveSeconds: number;
    neutralSeconds: number;
    activityPercent: number;
  };
  attendance: {
    arrival: string | null;
    departure: string | null;
    workdayStart: string;
    workdayEnd: string;
    timezone: string;
    lateMinutes: number;
    overtimeMinutes: number;
  };
  topApps: { name: string; seconds: number; productivity: string }[];
  topWebsites: { domain: string; seconds: number; productivity: string }[];
  topWindows: { title: string; seconds: number }[];
  daily: {
    day: string;
    activeHours: number;
    idleHours: number;
    productiveHours: number;
    unproductiveHours: number;
  }[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiClient.get<DashboardStats>("/api/dashboard/stats"),
    refetchInterval: 15_000,
  });
}

export type EmployeeRow = Employee & {
  todayProductiveSeconds: number;
  todayUnproductiveSeconds: number;
  enrolled: boolean;
};

export function useEmployees(params: { search?: string; department?: string; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.department) qs.set("department", params.department);
  if (params.status) qs.set("status", params.status);
  const query = qs.toString();
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => apiClient.get<EmployeeRow[]>(`/api/employees${query ? `?${query}` : ""}`),
    refetchInterval: 20_000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => apiClient.post<Employee>("/api/employees", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export type EmployeeDetail = Employee & {
  enrollmentToken: string;
  devices?: { id: string; hostname: string; platform: string; lastSeen: string | null }[];
};

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: () => apiClient.get<EmployeeDetail>(`/api/employees/${id}`),
    enabled: Boolean(id),
  });
}

export function useEmployeeStats(id: string, date: string, days = 7) {
  const qs = new URLSearchParams({ date, days: String(days) });
  return useQuery({
    queryKey: ["employee-stats", id, date, days],
    queryFn: () => apiClient.get<EmployeeStatsResponse>(`/api/employees/${id}/stats?${qs.toString()}`),
    enabled: Boolean(id),
  });
}

export function useScreenshots(params: { employeeId?: string; date?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.employeeId && params.employeeId !== "all") qs.set("employeeId", params.employeeId);
  if (params.date) qs.set("date", params.date);
  if (params.page) qs.set("page", String(params.page));
  return useQuery({
    queryKey: ["screenshots", params],
    queryFn: () => apiClient.get<Paginated<ScreenshotRow>>(`/api/screenshots?${qs.toString()}`),
  });
}

export function useReport(type: string, employeeId: string) {
  const qs = new URLSearchParams({ type, employeeId });
  return useQuery({
    queryKey: ["report", type, employeeId],
    queryFn: () => apiClient.get<ReportSummary>(`/api/reports?${qs.toString()}`),
  });
}

export function useAnalytics(days: number, employeeId: string) {
  const qs = new URLSearchParams({ days: String(days), employeeId });
  return useQuery({
    queryKey: ["analytics", days, employeeId],
    queryFn: () => apiClient.get<AnalyticsResponse>(`/api/analytics?${qs.toString()}`),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.get<AppSettings>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AppSettings>) => apiClient.patch<AppSettings>("/api/settings", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export interface ProductivityRuleInput {
  pattern: string;
  type: "APP" | "WEBSITE";
  productivity: "PRODUCTIVE" | "NEUTRAL" | "UNPRODUCTIVE";
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductivityRuleInput) => apiClient.post("/api/settings/rules", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/settings/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

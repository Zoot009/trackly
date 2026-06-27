"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  SOCKET_EVENTS,
  EmployeeStatus,
  ActivityState,
  formatDuration,
  type LiveActivityPayload,
  type LiveStatusPayload,
} from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useEmployees } from "@/hooks/queries";
import { initials } from "@/lib/utils";

interface LiveRow {
  employeeId: string;
  name: string;
  department: string | null;
  status: EmployeeStatus;
  currentApp: string | null;
  windowTitle: string | null;
  currentWebsite: string | null;
  activityPercent: number;
  idleSeconds: number;
  updatedAt: string;
}

export default function LivePage() {
  const { data: employees } = useEmployees();
  const [rows, setRows] = useState<Record<string, LiveRow>>({});

  // Seed rows from the initial employee snapshot.
  useEffect(() => {
    if (!employees) return;
    setRows((prev) => {
      const next = { ...prev };
      for (const e of employees) {
        next[e.id] ??= {
          employeeId: e.id,
          name: e.name,
          department: e.department,
          status: e.status,
          currentApp: e.currentApp,
          windowTitle: null,
          currentWebsite: e.currentWebsite,
          activityPercent: 0,
          idleSeconds: e.todayIdleSeconds,
          updatedAt: e.lastSeen ?? new Date().toISOString(),
        };
      }
      return next;
    });
  }, [employees]);

  const { connected } = useLiveSocket<LiveActivityPayload>(SOCKET_EVENTS.LIVE_ACTIVITY, (p) => {
    setRows((prev) => ({
      ...prev,
      [p.employeeId]: {
        ...(prev[p.employeeId] ?? {
          employeeId: p.employeeId,
          name: "Unknown",
          department: null,
        }),
        status: p.state === ActivityState.IDLE ? EmployeeStatus.IDLE : EmployeeStatus.ONLINE,
        currentApp: p.currentApp,
        windowTitle: p.windowTitle,
        currentWebsite: p.currentWebsite,
        activityPercent: p.activityPercent,
        idleSeconds: p.idleSeconds,
        updatedAt: p.timestamp,
      } as LiveRow,
    }));
  });

  useLiveSocket<LiveStatusPayload>(SOCKET_EVENTS.LIVE_STATUS, (p) => {
    setRows((prev) =>
      prev[p.employeeId]
        ? { ...prev, [p.employeeId]: { ...prev[p.employeeId]!, status: p.status, updatedAt: p.lastSeen } }
        : prev,
    );
  });

  const list = Object.values(rows).sort((a, b) => {
    const order = { ONLINE: 0, IDLE: 1, OFFLINE: 2 } as const;
    return order[a.status] - order[b.status];
  });

  return (
    <>
      <PageHeader
        title="Live Activity"
        description="Real-time view of what every employee is doing right now."
        actions={
          <Badge variant="outline" className="gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-[hsl(var(--success))] animate-pulse-dot" : "bg-muted-foreground/40"}`}
            />
            {connected ? "Connected" : "Reconnecting…"}
          </Badge>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Active Window</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="text-right">Idle</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No live data yet.
                </TableCell>
              </TableRow>
            ) : (
              list.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(r.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{r.name}</p>
                        {r.department && <p className="text-xs text-muted-foreground">{r.department}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusDot status={r.status} />
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.currentApp ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {r.windowTitle ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground">
                    {r.currentWebsite ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-foreground" style={{ width: `${r.activityPercent}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {r.activityPercent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatDuration(r.idleSeconds)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

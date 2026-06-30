"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { formatDuration } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusDot } from "@/components/status-dot";
import { ProductivityBar } from "@/components/charts/productivity-bar";
import { ActiveIdleChart } from "@/components/charts/active-idle-chart";
import { ScreenshotPreview } from "@/components/screenshot-preview";
import { DeployAgent } from "@/components/deploy-agent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployee, useEmployeeStats, useScreenshots } from "@/hooks/queries";
import { initials } from "@/lib/utils";

const PRODUCTIVITY_VARIANT = {
  PRODUCTIVE: "default",
  UNPRODUCTIVE: "muted",
  NEUTRAL: "secondary",
} as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [date, setDate] = useState(today());
  const [days, setDays] = useState("7");

  const { data: employee } = useEmployee(id);
  const { data: stats, isLoading } = useEmployeeStats(id, date, Number(days));
  const { data: shots } = useScreenshots({ employeeId: id, date });

  const summary = stats?.summary;
  const prodTotal =
    (summary?.productiveSeconds ?? 0) + (summary?.unproductiveSeconds ?? 0) + (summary?.neutralSeconds ?? 0) || 1;
  const pct = (s: number) => Math.round((s / prodTotal) * 100);

  return (
    <>
      <PageHeader
        title={employee?.name ?? "Employee"}
        description={employee?.email}
        actions={
          <Button variant="outline" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4" /> All employees
            </Link>
          </Button>
        }
      />

      {/* Identity + live snapshot */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(employee?.name ?? "?")}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{employee?.name ?? "—"}</p>
                {employee?.department && <Badge variant="muted">{employee.department}</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {employee && <StatusDot status={employee.status} />}
                <span>App: {employee?.currentApp ?? "—"}</span>
                <span>Site: {employee?.currentWebsite ?? "—"}</span>
                <span>
                  Last seen:{" "}
                  {employee?.lastSeen ? format(new Date(employee.lastSeen), "MMM d, HH:mm") : "—"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Show the install command only until the agent first reports in. */}
      {employee?.enrollmentToken && !employee.lastSeen && (
        <DeployAgent token={employee.enrollmentToken} employeeName={employee.name} />
      )}

      {/* Day metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading || !summary ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Worked" value={formatDuration(summary.workedSeconds)} />
            <StatCard label="Idle" value={formatDuration(summary.idleSeconds)} />
            <StatCard label="Productive" value={formatDuration(summary.productiveSeconds)} />
            <StatCard label="Unproductive" value={formatDuration(summary.unproductiveSeconds)} />
            <StatCard label="Activity" value={`${summary.activityPercent}%`} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Productivity ({format(new Date(`${date}T00:00:00`), "MMM d")})</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <ProductivityBar
                productive={pct(summary.productiveSeconds)}
                neutral={pct(summary.neutralSeconds)}
                unproductive={pct(summary.unproductiveSeconds)}
              />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active vs Idle Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? <ActiveIdleChart data={stats.daily} /> : <Skeleton className="h-72" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageTable
          title="Application Usage"
          isLoading={isLoading}
          rows={stats?.topApps.map((a) => ({ name: a.name, seconds: a.seconds, productivity: a.productivity }))}
        />
        <UsageTable
          title="Website Usage"
          isLoading={isLoading}
          rows={stats?.topWebsites.map((w) => ({ name: w.domain, seconds: w.seconds, productivity: w.productivity }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Screenshots ({format(new Date(`${date}T00:00:00`), "MMM d")})</CardTitle>
        </CardHeader>
        <CardContent>
          {!shots || shots.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No screenshots for this date.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {shots.data.slice(0, 12).map((shot) => (
                <ScreenshotPreview key={shot.id} shot={shot} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function UsageTable({
  title,
  rows,
  isLoading,
}: {
  title: string;
  rows?: { name: string; seconds: number; productivity: string }[];
  isLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Productivity</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : !rows || rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  No data for this date.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={PRODUCTIVITY_VARIANT[r.productivity as keyof typeof PRODUCTIVITY_VARIANT]}>
                      {r.productivity.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(r.seconds)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

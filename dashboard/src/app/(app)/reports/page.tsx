"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { ReportType, formatDuration, secondsToHours } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployees, useReport } from "@/hooks/queries";
import { downloadCsv } from "@/lib/csv";

const PRODUCTIVITY_VARIANT = {
  PRODUCTIVE: "default",
  UNPRODUCTIVE: "muted",
  NEUTRAL: "secondary",
} as const;

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>(ReportType.DAILY);
  const [employeeId, setEmployeeId] = useState("all");

  const { data: employees } = useEmployees();
  const { data, isLoading } = useReport(type, employeeId);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ...data.topApps.map((a) => ({
        category: "Application",
        name: a.name,
        productivity: a.productivity,
        hours: secondsToHours(a.seconds),
      })),
      ...data.topWebsites.map((w) => ({
        category: "Website",
        name: w.domain,
        productivity: w.productivity,
        hours: secondsToHours(w.seconds),
      })),
    ];
    downloadCsv(`flowace-report-${type.toLowerCase()}-${format(new Date(), "yyyyMMdd")}.csv`, rows);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily, weekly and monthly productivity reports."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={type} onValueChange={(v) => setType(v as ReportType)}>
          <TabsList>
            <TabsTrigger value={ReportType.DAILY}>Daily</TabsTrigger>
            <TabsTrigger value={ReportType.WEEKLY}>Weekly</TabsTrigger>
            <TabsTrigger value={ReportType.MONTHLY}>Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Worked" value={formatDuration(data.workedSeconds)} />
            <StatCard label="Idle" value={formatDuration(data.idleSeconds)} />
            <StatCard label="Productive" value={formatDuration(data.productiveSeconds)} />
            <StatCard label="Unproductive" value={formatDuration(data.unproductiveSeconds)} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageTable
          title="Application Usage"
          isLoading={isLoading}
          rows={data?.topApps.map((a) => ({ name: a.name, seconds: a.seconds, productivity: a.productivity }))}
        />
        <UsageTable
          title="Website Usage"
          isLoading={isLoading}
          rows={data?.topWebsites.map((w) => ({
            name: w.domain,
            seconds: w.seconds,
            productivity: w.productivity,
          }))}
        />
      </div>
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
                  No data for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={PRODUCTIVITY_VARIANT[r.productivity as keyof typeof PRODUCTIVITY_VARIANT]}
                    >
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

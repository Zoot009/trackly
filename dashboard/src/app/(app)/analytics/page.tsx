"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalytics, useEmployees } from "@/hooks/queries";
import { UsageBarChart } from "@/components/charts/usage-bar-chart";
import { ActiveIdleChart } from "@/components/charts/active-idle-chart";
import { ProductivityDonut } from "@/components/charts/productivity-donut";

export default function AnalyticsPage() {
  const [days, setDays] = useState("7");
  const [employeeId, setEmployeeId] = useState("all");
  const { data: employees } = useEmployees();
  const { data, isLoading } = useAnalytics(Number(days), employeeId);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Trends across applications, websites and productivity."
        actions={
          <div className="flex gap-2">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-44">
                <SelectValue />
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
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active vs Idle Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-72" />
            ) : (
              <ActiveIdleChart data={data.activeByDay} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productivity Split</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {isLoading || !data ? <Skeleton className="h-72 w-full" /> : <ProductivityDonut data={data.productivity} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-72" />
            ) : (
              <UsageBarChart data={data.topApps.map((a) => ({ label: a.name, seconds: a.seconds }))} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Websites</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-72" />
            ) : (
              <UsageBarChart data={data.topWebsites.map((w) => ({ label: w.domain, seconds: w.seconds }))} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

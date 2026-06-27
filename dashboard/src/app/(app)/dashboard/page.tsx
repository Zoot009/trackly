"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/queries";
import { ProductivityBar } from "@/components/charts/productivity-bar";
import { LiveFeed } from "@/components/live-feed";
import { RecentScreenshots } from "@/components/recent-screenshots";
import { AgentHealth } from "@/components/agent-health";

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();

  return (
    <>
      <PageHeader title="Dashboard" description="Real-time overview of your workforce today." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total" value={data.totalEmployees} />
            <StatCard label="Online" value={data.onlineEmployees} />
            <StatCard label="Offline" value={data.offlineEmployees} />
            <StatCard label="Active" value={data.activeEmployees} />
            <StatCard label="Idle" value={data.idleEmployees} />
            <StatCard label="Hours Today" value={`${data.totalHoursToday}h`} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Productivity Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <ProductivityBar
                productive={data.productivePercent}
                neutral={data.neutralPercent}
                unproductive={data.unproductivePercent}
              />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AgentHealth />
          <Card>
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <LiveFeed />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Screenshot Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentScreenshots />
        </CardContent>
      </Card>
    </>
  );
}

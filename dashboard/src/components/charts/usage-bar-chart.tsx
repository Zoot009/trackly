"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { secondsToHours } from "@flowace/shared";
import { ChartTooltip } from "./chart-tooltip";

export function UsageBarChart({ data }: { data: { label: string; seconds: number }[] }) {
  const chartData = data.map((d) => ({ label: d.label, hours: secondsToHours(d.seconds) }));

  return (
    <div className="h-72 w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip unit="h" />} />
          <Bar dataKey="hours" fill="currentColor" radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

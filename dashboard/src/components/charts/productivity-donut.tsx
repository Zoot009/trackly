"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { secondsToHours } from "@flowace/shared";

const SLICES = [
  { key: "PRODUCTIVE", label: "Productive", opacity: 1 },
  { key: "NEUTRAL", label: "Neutral", opacity: 0.5 },
  { key: "UNPRODUCTIVE", label: "Unproductive", opacity: 0.2 },
] as const;

export function ProductivityDonut({
  data,
}: {
  data: { PRODUCTIVE: number; UNPRODUCTIVE: number; NEUTRAL: number };
}) {
  const chartData = SLICES.map((s) => ({
    name: s.label,
    value: data[s.key],
    opacity: s.opacity,
  }));
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex w-full flex-col items-center gap-4 text-foreground">
      <div className="relative h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill="currentColor" fillOpacity={entry.opacity} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{secondsToHours(total)}h</span>
          <span className="text-xs text-muted-foreground">tracked</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-2">
        {chartData.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-foreground" style={{ opacity: entry.opacity }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums">{secondsToHours(entry.value)}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

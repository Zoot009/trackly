"use client";

import type { TooltipProps } from "recharts";

/** Minimal monochrome tooltip used across all charts. */
export function ChartTooltip({ active, payload, label, unit = "" }: TooltipProps<number, string> & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="capitalize text-muted-foreground">{entry.name}</span>
          <span className="font-medium tabular-nums">
            {entry.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

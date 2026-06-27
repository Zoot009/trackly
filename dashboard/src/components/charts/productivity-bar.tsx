"use client";

import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "productive", label: "Productive", className: "bg-foreground" },
  { key: "neutral", label: "Neutral", className: "bg-muted-foreground/50" },
  { key: "unproductive", label: "Unproductive", className: "bg-muted-foreground/20" },
] as const;

export function ProductivityBar({
  productive,
  neutral,
  unproductive,
}: {
  productive: number;
  neutral: number;
  unproductive: number;
}) {
  const values = { productive, neutral, unproductive };
  return (
    <div className="space-y-6">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {SEGMENTS.map((s) => (
          <div
            key={s.key}
            className={cn("h-full transition-all", s.className)}
            style={{ width: `${values[s.key]}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-sm", s.className)} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{values[s.key]}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

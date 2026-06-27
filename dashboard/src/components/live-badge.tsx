"use client";

import { SOCKET_EVENTS, type LiveStatusPayload } from "@flowace/shared";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { cn } from "@/lib/utils";

/** Small connection indicator wired to the realtime socket. */
export function LiveBadge() {
  const { connected } = useLiveSocket<LiveStatusPayload>(SOCKET_EVENTS.LIVE_STATUS, () => {});
  return (
    <div className="hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium sm:flex">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          connected ? "bg-[hsl(var(--success))] animate-pulse-dot" : "bg-muted-foreground/40",
        )}
      />
      {connected ? "Live" : "Offline"}
    </div>
  );
}

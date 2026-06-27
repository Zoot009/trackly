"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { SOCKET_EVENTS, type LiveFeedPayload } from "@flowace/shared";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export function LiveFeed() {
  const [events, setEvents] = useState<LiveFeedPayload[]>([]);

  useLiveSocket<LiveFeedPayload>(SOCKET_EVENTS.LIVE_FEED, (payload) => {
    setEvents((prev) => [payload, ...prev].slice(0, 25));
  });

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Waiting for live events…
      </p>
    );
  }

  return (
    <div className="max-h-80 space-y-3 overflow-y-auto scrollbar-thin">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 animate-fade-in">
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials(e.employeeName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-medium">{e.employeeName}</span>{" "}
              <span className="text-muted-foreground">{e.message}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

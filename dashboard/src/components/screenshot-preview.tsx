"use client";

import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ScreenshotRow } from "@/hooks/queries";

/** Thumbnail that opens a fullscreen preview on click. */
export function ScreenshotPreview({ shot }: { shot: ScreenshotRow }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group relative overflow-hidden rounded-lg border bg-muted text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.thumbnailUrl}
            alt={`${shot.employee.name} screenshot`}
            className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="truncate text-xs font-medium text-white">{shot.employee.name}</p>
            <p className="text-[10px] text-white/70">{format(new Date(shot.capturedAt), "MMM d, HH:mm")}</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl p-2">
        <DialogTitle className="sr-only">
          {shot.employee.name} — {format(new Date(shot.capturedAt), "PPpp")}
        </DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt="screenshot" className="w-full rounded-lg" />
        <div className="flex items-center justify-between px-2 py-1 text-sm">
          <span className="font-medium">{shot.employee.name}</span>
          <span className="text-muted-foreground">{format(new Date(shot.capturedAt), "PPpp")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

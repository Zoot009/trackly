"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ScreenshotRow } from "@/hooks/queries";
import { cn } from "@/lib/utils";

/**
 * Thumbnail that opens a fullscreen preview on click. Selection and delete are
 * opt-in: pass `onToggleSelect` to show a checkbox, `onDelete` to show a Delete
 * button in the preview. Without them it is a plain read-only preview.
 */
export function ScreenshotPreview({
  shot,
  selected = false,
  selecting = false,
  onToggleSelect,
  onDelete,
}: {
  shot: ScreenshotRow;
  selected?: boolean;
  /** Something on the page is selected — keep every checkbox visible. */
  selecting?: boolean;
  onToggleSelect?: (shot: ScreenshotRow) => void;
  onDelete?: (shot: ScreenshotRow) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* The checkbox is a sibling of the trigger, not inside it — a button
          nested in a button is invalid HTML and would also open the preview. */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border bg-muted",
          selected && "ring-2 ring-primary",
        )}
      >
        <DialogTrigger asChild>
          <button className="block w-full text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring">
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

        {onToggleSelect && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? "Deselect screenshot" : "Select screenshot"}
            onClick={() => onToggleSelect(shot)}
            className={cn(
              "absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary text-primary-foreground opacity-100"
                : "border-white/80 bg-black/40 text-transparent",
              !selected && (selecting ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"),
            )}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
      </div>

      <DialogContent className="max-w-5xl p-2">
        <DialogTitle className="sr-only">
          {shot.employee.name} — {format(new Date(shot.capturedAt), "PPpp")}
        </DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt="screenshot" className="w-full rounded-lg" />
        <div className="flex items-center justify-between gap-3 px-2 py-1 text-sm">
          <span className="font-medium">{shot.employee.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{format(new Date(shot.capturedAt), "PPpp")}</span>
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  // Close the preview first so it doesn't linger on a deleted image.
                  setOpen(false);
                  onDelete(shot);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

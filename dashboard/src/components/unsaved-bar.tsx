"use client";

import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Clerk-style floating "Unsaved changes" bar. Appears at the bottom-centre when
 * a form has pending edits, with Reset (revert) + Save actions.
 */
export function UnsavedBar({
  show,
  onReset,
  onSave,
  saving = false,
}: {
  show: boolean;
  onReset: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-popover px-3 py-2 text-popover-foreground shadow-lg animate-in slide-in-from-bottom-4 fade-in">
        <Info className="ml-1 h-4 w-4 text-muted-foreground" />
        <span className="text-sm">Unsaved changes</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} disabled={saving}>
            Reset
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

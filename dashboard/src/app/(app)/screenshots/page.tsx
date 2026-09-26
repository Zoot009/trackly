"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteScreenshots, useEmployees, useScreenshots } from "@/hooks/queries";
import { ScreenshotPreview } from "@/components/screenshot-preview";
import { ApiError } from "@/lib/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScreenshotsPage() {
  const [employeeId, setEmployeeId] = useState("all");
  const [date, setDate] = useState(today());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids awaiting confirmation in the delete dialog (null = dialog closed).
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const { data: employees } = useEmployees();
  const { data, isLoading } = useScreenshots({ employeeId, date, page });
  const del = useDeleteScreenshots();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageIds = data?.data.map((s) => s.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  // A selection only makes sense for the screenshots currently on screen.
  useEffect(() => {
    setSelected(new Set());
  }, [employeeId, date, page]);

  // Deleting the last screenshots on a later page would leave it empty; step back.
  useEffect(() => {
    if (data && data.data.length === 0 && page > 1) setPage((p) => p - 1);
  }, [data, page]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected(allOnPageSelected ? new Set() : new Set(pageIds));
  }

  async function confirmDelete() {
    if (!pendingIds) return;
    try {
      const res = await del.mutateAsync(pendingIds);
      toast.success(`Deleted ${res.deleted} screenshot${res.deleted === 1 ? "" : "s"}`);
      setSelected((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete screenshots");
    } finally {
      setPendingIds(null);
    }
  }

  const pendingCount = pendingIds?.length ?? 0;

  return (
    <>
      <PageHeader title="Screenshots" description="Browse captured screenshots by employee and date." />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Employee</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => {
                setEmployeeId(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className="sm:w-48"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No screenshots for the selected filters.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected`
                : "Tick screenshots to delete them, or open one to delete it."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleAllOnPage}>
                {allOnPageSelected ? "Clear selection" : "Select all on page"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => setPendingIds([...selected])}
              >
                <Trash2 className="h-4 w-4" /> Delete{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.data.map((shot) => (
              <ScreenshotPreview
                key={shot.id}
                shot={shot}
                selected={selected.has(shot.id)}
                selecting={selected.size > 0}
                onToggleSelect={(s) => toggle(s.id)}
                onDelete={(s) => setPendingIds([s.id])}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data.total} screenshots · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!pendingIds} onOpenChange={(o) => !o && !del.isPending && setPendingIds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {pendingCount} screenshot{pendingCount === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes {pendingCount === 1 ? "the image" : "these images"} from the
              server. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingIds(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

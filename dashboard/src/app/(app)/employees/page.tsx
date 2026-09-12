"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmployeeStatus, formatDuration } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteEmployee, useEmployees } from "@/hooks/queries";
import { AddEmployeeDialog } from "@/components/add-employee-dialog";
import { EditEmployeeDialog, type EditableEmployee } from "@/components/edit-employee-dialog";
import { initials } from "@/lib/utils";

type SortKey = "name" | "status" | "currentApp" | "productive" | "unproductive" | "idle" | "lastSeen";

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5 opacity-60" />
      </button>
    </TableHead>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading } = useEmployees({
    search,
    status: status === "all" ? undefined : status,
  });
  const del = useDeleteEmployee();
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [toEdit, setToEdit] = useState<EditableEmployee | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const rows = useMemo(() => {
    if (!data || !sort) return data;
    const value = (e: (typeof data)[number]): string | number => {
      switch (sort.key) {
        case "name": return e.name.toLowerCase();
        case "status": return e.status;
        case "currentApp": return (e.currentApp ?? "").toLowerCase();
        case "productive": return e.todayProductiveSeconds;
        case "unproductive": return e.todayUnproductiveSeconds;
        case "idle": return e.todayIdleSeconds;
        case "lastSeen": return e.lastSeen ? new Date(e.lastSeen).getTime() : 0;
      }
    };
    return [...data].sort((a, b) => {
      const av = value(a), bv = value(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sort]);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(`Removed ${toDelete.name}`);
    } catch {
      toast.error("Failed to remove employee");
    } finally {
      setToDelete(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage and monitor all tracked employees."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add Employee
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value={EmployeeStatus.ONLINE}>Online</SelectItem>
            <SelectItem value={EmployeeStatus.IDLE}>Idle</SelectItem>
            <SelectItem value={EmployeeStatus.OFFLINE}>Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Employee" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortHead label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortHead label="Current App" sortKey="currentApp" sort={sort} onSort={toggleSort} />
              <SortHead label="Productive" sortKey="productive" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Unproductive" sortKey="unproductive" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Idle" sortKey="idle" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Last Seen" sortKey="lastSeen" sort={sort} onSort={toggleSort} />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              rows!.map((emp) => {
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials(emp.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{emp.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusDot status={emp.status} />
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {emp.currentApp ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatDuration(emp.todayProductiveSeconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDuration(emp.todayUnproductiveSeconds)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDuration(emp.todayIdleSeconds)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {emp.lastSeen ? format(new Date(emp.lastSeen), "d MMM yyyy, HH:mm") : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setToEdit({ id: emp.id, name: emp.name, email: emp.email })
                            }
                          >
                            <Pencil className="h-4 w-4" /> Edit details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setToDelete({ id: emp.id, name: emp.name })}
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />

      <EditEmployeeDialog employee={toEdit} onOpenChange={(o) => !o && setToEdit(null)} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {toDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes {toDelete?.name} and all their data — devices, activity,
              usage and screenshots. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

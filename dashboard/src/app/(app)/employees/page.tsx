"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { MoreHorizontal, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmployeeStatus, formatDuration } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteEmployee, useEmployees } from "@/hooks/queries";
import { AddEmployeeDialog } from "@/components/add-employee-dialog";
import { initials } from "@/lib/utils";

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

  async function handleDelete(id: string, name: string) {
    try {
      await del.mutateAsync(id);
      toast.success(`Removed ${name}`);
    } catch {
      toast.error("Failed to remove employee");
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
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current App</TableHead>
              <TableHead className="text-right">Productive</TableHead>
              <TableHead className="text-right">Unproductive</TableHead>
              <TableHead className="text-right">Idle</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                  No employees found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((emp) => {
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
                      {emp.department ? (
                        <Badge variant="muted">{emp.department}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                    <TableCell className="text-muted-foreground">
                      {emp.lastSeen ? format(new Date(emp.lastSeen), "MMM d, HH:mm") : "—"}
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
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(emp.id, emp.name)}
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
    </>
  );
}

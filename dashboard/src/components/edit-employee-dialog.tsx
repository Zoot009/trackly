"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { editEmployeeSchema, type EditEmployeeInput } from "@flowace/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useUpdateEmployee } from "@/hooks/queries";

export type EditableEmployee = { id: string; name: string; email: string };

export function EditEmployeeDialog({
  employee,
  onOpenChange,
}: {
  employee: EditableEmployee | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateEmployee(employee?.id ?? "");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditEmployeeInput>({ resolver: zodResolver(editEmployeeSchema) });

  // The dialog stays mounted between openings, so pull in the selected row's
  // current values each time a different employee is picked.
  useEffect(() => {
    if (employee) reset({ name: employee.name, email: employee.email });
  }, [employee, reset]);

  async function onSubmit(values: EditEmployeeInput) {
    if (!employee) return;
    try {
      await update.mutateAsync(values);
      toast.success("Employee updated");
      onOpenChange(false);
    } catch (err) {
      // Surface the API message so a duplicate email reads clearly (409).
      toast.error(err instanceof ApiError ? err.message : "Failed to update employee");
    }
  }

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Update the name and email on this record. Their enrolled agents and tracked
            history are unaffected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" {...register("name")} placeholder="Jane Cooper" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" {...register("email")} placeholder="jane@company.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

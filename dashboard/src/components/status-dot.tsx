import { EmployeeStatus } from "@flowace/shared";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<EmployeeStatus, { dot: string; label: string }> = {
  [EmployeeStatus.ONLINE]: { dot: "bg-[hsl(var(--success))]", label: "Online" },
  [EmployeeStatus.IDLE]: { dot: "bg-[hsl(var(--warning))]", label: "Idle" },
  [EmployeeStatus.OFFLINE]: { dot: "bg-muted-foreground/40", label: "Offline" },
};

export function StatusDot({
  status,
  withLabel = true,
  className,
}: {
  status: EmployeeStatus;
  withLabel?: boolean;
  className?: string;
}) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex h-2 w-2">
        {status === EmployeeStatus.ONLINE && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot", style.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", style.dot)} />
      </span>
      {withLabel && <span className="text-sm text-muted-foreground">{style.label}</span>}
    </span>
  );
}

"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { EmployeeStatus } from "@flowace/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmployees } from "@/hooks/queries";

/**
 * Tamper / health monitor. Flags employees who have an enrolled agent but are
 * currently offline — i.e. the agent stopped reporting (machine off, network
 * down, or the agent was removed/killed). This is the lawful way to enforce
 * "the agent can't just be removed": you're alerted the moment one goes silent.
 */
export function AgentHealth() {
  const { data } = useEmployees();
  if (!data) return null;

  const enrolled = data.filter((e) => e.enrolled);
  const offline = enrolled.filter((e) => e.status === EmployeeStatus.OFFLINE);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {offline.length === 0 ? (
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-[hsl(var(--warning))]" />
          )}
          Agent Health
        </CardTitle>
        <Badge variant={offline.length === 0 ? "muted" : "secondary"}>
          {enrolled.length - offline.length}/{enrolled.length} reporting
        </Badge>
      </CardHeader>
      <CardContent>
        {offline.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            All enrolled agents are reporting normally.
          </p>
        ) : (
          <ul className="space-y-2">
            {offline.map((e) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <Link href={`/employees/${e.id}`} className="font-medium hover:underline">
                  {e.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  silent{" "}
                  {e.lastSeen ? formatDistanceToNow(new Date(e.lastSeen), { addSuffix: true }) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

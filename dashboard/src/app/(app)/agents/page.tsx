"use client";

import { formatDistanceToNow } from "date-fns";
import { Ghost, Monitor, Trash2, Circle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAgents, usePurgeGhost, type AgentRow, type GhostAgentRow } from "@/hooks/queries";

function platformLabel(p: string): string {
  if (p.startsWith("darwin")) return "macOS";
  if (p.startsWith("win")) return "Windows";
  if (p.startsWith("linux")) return "Linux";
  return p || "—";
}

function ago(iso: string | null): string {
  return iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "—";
}

export default function AgentsPage() {
  const { data, isLoading } = useAgents();
  const purge = usePurgeGhost();

  const agents: AgentRow[] = data?.agents ?? [];
  const ghosts: GhostAgentRow[] = data?.ghosts ?? [];
  const activeGhosts = ghosts.filter((g) => g.stillReporting);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Every agent connected to the backend. Ghost agents were removed from the dashboard but may still be installed and reporting — track them down and uninstall them."
      />

      {/* Ghost agents — the priority. Removed from the dashboard but still phoning home. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Ghost className="h-4 w-4 text-destructive" />
              Ghost agents
            </CardTitle>
            <CardDescription>
              Removed from the dashboard, but the agent is still installed. If it&apos;s{" "}
              <span className="font-medium text-destructive">still reporting</span>, uninstall it
              from that machine, then purge the record here.
            </CardDescription>
          </div>
          {activeGhosts.length > 0 && (
            <Badge variant="secondary" className="whitespace-nowrap">
              {activeGhosts.length} still reporting
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : ghosts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No ghost agents — every removed employee&apos;s agent is confirmed gone.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Was</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Removed</TableHead>
                    <TableHead>Last reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ghosts.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.hostname}</TableCell>
                      <TableCell className="text-muted-foreground">{g.employeeName}</TableCell>
                      <TableCell>{platformLabel(g.platform)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ago(g.removedAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ago(g.lastSeenAt)}
                      </TableCell>
                      <TableCell>
                        {g.stillReporting ? (
                          <Badge className="whitespace-nowrap border-transparent bg-destructive text-destructive-foreground">
                            Still reporting
                          </Badge>
                        ) : (
                          <Badge variant="muted">Silent</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={purge.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Purge the ghost record for ${g.hostname}? Do this only after the agent is uninstalled — otherwise it'll reappear when the machine reports again.`,
                              )
                            ) {
                              purge.mutate(g.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Purge
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All live agents. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Connected agents
          </CardTitle>
          <CardDescription>
            Enrolled agents linked to an employee, with their live connection status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : agents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No agents enrolled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a) => (
                    <TableRow key={a.deviceId}>
                      <TableCell className="font-medium">{a.hostname}</TableCell>
                      <TableCell className="text-muted-foreground">{a.employeeName}</TableCell>
                      <TableCell>{platformLabel(a.platform)}</TableCell>
                      <TableCell className="text-muted-foreground">{a.agentVersion || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ago(a.lastSeen)}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <Circle
                            className={`h-2 w-2 ${
                              a.online
                                ? "fill-[hsl(var(--success))] text-[hsl(var(--success))]"
                                : "fill-muted-foreground text-muted-foreground"
                            }`}
                          />
                          {a.online ? "Online" : "Offline"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

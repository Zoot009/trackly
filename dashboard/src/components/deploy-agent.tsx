"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

/** Renders ready-to-send install commands for an employee's enrollment token.
 * Each command provisions the token + backend URL and installs the agent. */
export function DeployAgent({ token, employeeName }: { token: string; employeeName: string }) {
  const base = config.installBase.replace(/\/$/, "");
  const server = config.apiUrl.replace(/\/$/, "");

  const commands = {
    windows: `$env:TRACKLY_TOKEN="${token}"; $env:TRACKLY_SERVER="${server}"; irm ${base}/install.ps1 | iex`,
    macos: `curl -fsSL ${base}/install.sh | sudo TRACKLY_TOKEN="${token}" TRACKLY_SERVER="${server}" bash`,
    linux: `curl -fsSL ${base}/install.sh | sudo TRACKLY_TOKEN="${token}" TRACKLY_SERVER="${server}" bash`,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy agent</CardTitle>
        <CardDescription>
          Send {employeeName} the command for their OS. Running it installs Trackly and enrolls the
          device automatically — no further steps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="windows">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos">macOS</TabsTrigger>
            <TabsTrigger value="linux">Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows">
            <CommandBlock label="PowerShell (approve the admin prompt)" command={commands.windows} />
          </TabsContent>
          <TabsContent value="macos">
            <CommandBlock label="Terminal (asks for admin password)" command={commands.macos} />
          </TabsContent>
          <TabsContent value="linux">
            <CommandBlock label="Terminal (asks for admin password)" command={commands.linux} />
          </TabsContent>
        </Tabs>
        <p className="mt-3 text-xs text-muted-foreground">
          The enrollment token is unique to this employee. Treat it like a password.
        </p>
      </CardContent>
    </Card>
  );
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success("Command copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative rounded-lg border bg-muted/40">
        <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed scrollbar-thin">
          {command}
        </pre>
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          className="absolute right-1.5 top-1.5 h-7 w-7"
          aria-label="Copy command"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

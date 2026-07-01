"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { settingsSchema, type SettingsInput } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useSettings,
  useUpdateSettings,
  useCreateRule,
  useDeleteRule,
  type ProductivityRuleInput,
} from "@/hooks/queries";

export default function SettingsPage() {
  const { data, isLoading } = useSettings();
  const update = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (data) {
      reset({
        screenshotIntervalSec: data.screenshotIntervalSec,
        idleTimeoutSec: data.idleTimeoutSec,
        screenshotQuality: data.screenshotQuality,
        workdayStart: data.workdayStart,
        workdayEnd: data.workdayEnd,
        timezone: data.timezone,
        dataRetentionDays: data.dataRetentionDays,
        monitoringEnabled: data.monitoringEnabled,
      });
    }
  }, [data, reset]);

  async function onSubmit(values: SettingsInput) {
    try {
      await update.mutateAsync(values);
      reset(values);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Settings" description="Configure monitoring behavior." />
        <Skeleton className="h-96 rounded-xl" />
      </>
    );
  }

  const monitoring = watch("monitoringEnabled");
  const timezone = watch("timezone");
  const timezones =
    typeof (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === "function"
      ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone")
      : ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure how the desktop agent monitors employees."
        actions={
          <Button onClick={handleSubmit(onSubmit)} disabled={!isDirty || update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Capture</CardTitle>
            <CardDescription>Screenshot frequency and quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Screenshot interval (seconds)"
              error={errors.screenshotIntervalSec?.message}
            >
              <Input type="number" {...register("screenshotIntervalSec", { valueAsNumber: true })} />
            </Field>
            <Field label="Screenshot quality (1–100)" error={errors.screenshotQuality?.message}>
              <Input type="number" {...register("screenshotQuality", { valueAsNumber: true })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Idle detection — how long with no input counts as idle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Idle timeout (seconds)" error={errors.idleTimeoutSec?.message}>
              <Input type="number" {...register("idleTimeoutSec", { valueAsNumber: true })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working hours</CardTitle>
            <CardDescription>
              Only count activity within these hours in your timezone. Leave as 00:00 → 23:59 to
              count the whole day.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Timezone">
              <Select
                value={timezone}
                onValueChange={(v) => setValue("timezone", v, { shouldDirty: true })}
              >
                <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Workday start" error={errors.workdayStart?.message}>
                <Input type="time" {...register("workdayStart")} />
              </Field>
              <Field label="Workday end" error={errors.workdayEnd?.message}>
                <Input type="time" {...register("workdayEnd")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data retention</CardTitle>
            <CardDescription>How long to keep screenshots and logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field label="Retention period (days)" error={errors.dataRetentionDays?.message}>
              <Input type="number" {...register("dataRetentionDays", { valueAsNumber: true })} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Globally enable or pause monitoring.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Monitoring enabled</p>
                <p className="text-sm text-muted-foreground">
                  When off, agents pause tracking and screenshots.
                </p>
              </div>
              <Switch
                checked={monitoring}
                onCheckedChange={(v) => setValue("monitoringEnabled", v, { shouldDirty: true })}
              />
            </div>
          </CardContent>
        </Card>
      </form>

      <ProductivityRules rules={data?.productivityRules ?? []} />
    </>
  );
}

const PRODUCTIVITY_VARIANT = {
  PRODUCTIVE: "default",
  UNPRODUCTIVE: "muted",
  NEUTRAL: "secondary",
} as const;

function ProductivityRules({
  rules,
}: {
  rules: { id: string; pattern: string; type: "APP" | "WEBSITE"; productivity: string }[];
}) {
  const create = useCreateRule();
  const remove = useDeleteRule();
  const [pattern, setPattern] = useState("");
  const [type, setType] = useState<ProductivityRuleInput["type"]>("APP");
  const [productivity, setProductivity] = useState<ProductivityRuleInput["productivity"]>("PRODUCTIVE");

  async function addRule() {
    const value = pattern.trim();
    if (!value) return;
    try {
      await create.mutateAsync({ pattern: value, type, productivity });
      setPattern("");
      toast.success("Rule added");
    } catch {
      toast.error("Failed to add rule");
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Productivity rules</CardTitle>
        <CardDescription>
          Classify apps and websites as productive, neutral or unproductive. Matching is
          case-insensitive (substring, or use <code>*</code> as a wildcard). Applies to activity going
          forward.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add rule */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Pattern (app name or domain)</Label>
            <Input
              placeholder="e.g. Visual Studio Code, youtube, slack"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRule()}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ProductivityRuleInput["type"])}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="APP">App</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Productivity</Label>
            <Select
              value={productivity}
              onValueChange={(v) => setProductivity(v as ProductivityRuleInput["productivity"])}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCTIVE">Productive</SelectItem>
                <SelectItem value="NEUTRAL">Neutral</SelectItem>
                <SelectItem value="UNPRODUCTIVE">Unproductive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRule} disabled={create.isPending || !pattern.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* Existing rules */}
        <div className="divide-y rounded-lg border">
          {rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No rules yet. Add one above — anything unmatched stays Neutral.
            </p>
          ) : (
            rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary">{r.type === "APP" ? "App" : "Website"}</Badge>
                  <span className="truncate font-medium">{r.pattern}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={PRODUCTIVITY_VARIANT[r.productivity as keyof typeof PRODUCTIVITY_VARIANT]}>
                    {r.productivity.toLowerCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(r.id)}
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

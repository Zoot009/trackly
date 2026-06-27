"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { settingsSchema, type SettingsInput } from "@flowace/shared";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/hooks/queries";

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
            <CardDescription>Idle detection and working hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Idle timeout (seconds)" error={errors.idleTimeoutSec?.message}>
              <Input type="number" {...register("idleTimeoutSec", { valueAsNumber: true })} />
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
    </>
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

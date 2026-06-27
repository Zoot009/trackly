"use client";

import { Mail, Shield, User } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/store/auth";
import { initials } from "@/lib/utils";

export default function ProfilePage() {
  const admin = useAuth((s) => s.admin);

  return (
    <>
      <PageHeader title="Profile" description="Your administrator account details." />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials(admin?.name ?? "Admin")}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{admin?.name}</p>
              <Badge variant="secondary" className="mt-1">
                <Shield className="h-3 w-3" /> {admin?.role?.replace("_", " ").toLowerCase()}
              </Badge>
            </div>
          </div>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail icon={User} label="Full name" value={admin?.name ?? "—"} />
            <Detail icon={Mail} label="Email" value={admin?.email ?? "—"} />
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

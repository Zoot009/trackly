"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Send,
  Settings2,
  Users,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Flowace navigation mapped into the sidebar-08 structure: collapsible groups
// in the main nav, department shortcuts as "projects", and support links in the
// secondary nav.
const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: LayoutDashboard,
      items: [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Live Activity", url: "/live" },
      ],
    },
    {
      title: "Workforce",
      url: "/employees",
      icon: Users,
      items: [
        { title: "Employees", url: "/employees" },
        { title: "Screenshots", url: "/screenshots" },
      ],
    },
    {
      title: "Insights",
      url: "/reports",
      icon: BarChart3,
      items: [
        { title: "Reports", url: "/reports" },
        { title: "Analytics", url: "/analytics" },
      ],
    },
    {
      title: "System",
      url: "/settings",
      icon: Settings2,
      items: [
        { title: "Settings", url: "/settings" },
        { title: "Profile", url: "/profile" },
      ],
    },
  ],
  navSecondary: [
    { title: "Support", url: "https://docs.flowace.dev", icon: LifeBuoy, external: true },
    { title: "Send Feedback", url: "mailto:support@flowace.dev", icon: Send, external: true },
  ],
  departments: [
    { name: "Engineering", url: "/employees?department=Engineering", icon: Building2 },
    { name: "Sales", url: "/employees?department=Sales", icon: Building2 },
    { name: "Support", url: "/employees?department=Support", icon: Headphones },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Activity className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Trackly</span>
                  <span className="truncate text-xs">Workforce Monitoring</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.departments} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

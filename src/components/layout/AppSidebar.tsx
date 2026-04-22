import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogoLink } from "@/components/shared/LogoLink";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Server, Box, FileText, Bell, CreditCard, Settings,
  HelpCircle, ChevronLeft, ChevronRight,
  Building2, Users, Shield, BookOpen
} from "lucide-react";
import { useViewerState } from "@/hooks/useViewerState";

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/app" },
      { label: "Organizations", icon: Building2, href: "/app/organizations" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { label: "Hosts", icon: Server, href: "/app/hosts" },
      { label: "Containers", icon: Box, href: "/app/containers" },
    ],
  },
  {
    label: "Observability",
    items: [
      { label: "Logs", icon: FileText, href: "/app/logs" },
      { label: "Alerts", icon: Bell, href: "/app/alerts" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Billing", icon: CreditCard, href: "/app/billing" },
      { label: "Settings", icon: Settings, href: "/app/settings" },
      { label: "Admin", icon: Shield, href: "/app/admin" },
      { label: "Setup Guide", icon: BookOpen, href: "/app/setup-guide" },
      { label: "Help", icon: HelpCircle, href: "/app/help" },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { data: viewer } = useViewerState();

  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/app/admin" && !viewer?.is_platform_admin) return false;
      return true;
    }),
  }));

  return (
    <aside className={cn(
      "flex flex-col h-screen border-r border-border bg-sidebar shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
        <LogoLink className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Box className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-semibold text-sm tracking-tight whitespace-nowrap">Docker Dashboard</span>}
        </LogoLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1 block">
                {group.label}
              </span>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.href || (item.href !== "/app" && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

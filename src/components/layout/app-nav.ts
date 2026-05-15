import {
  Bell,
  Box,
  Building2,
  CreditCard,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Server,
  Settings,
  Shield,
} from "lucide-react";

export type AppNavIcon = typeof LayoutDashboard;

export type AppNavItem = {
  label: string;
  icon: AppNavIcon;
  href: string;
  premiumKey?: "canUseLogs" | "canUseFileManager";
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const appNavGroups: AppNavGroup[] = [
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
      { label: "Logs", icon: FileText, href: "/app/logs", premiumKey: "canUseLogs" },
      { label: "Files", icon: FolderOpen, href: "/app/files", premiumKey: "canUseFileManager" },
      { label: "Alerts", icon: Bell, href: "/app/alerts" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Billing", icon: CreditCard, href: "/app/billing" },
      { label: "Settings", icon: Settings, href: "/app/settings" },
      { label: "Admin", icon: Shield, href: "/app/admin" },
      { label: "Help", icon: HelpCircle, href: "/app/help" },
    ],
  },
];

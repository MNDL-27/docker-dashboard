import { useState } from "react";
import { Box, ChevronLeft, ChevronRight } from "lucide-react";
import { LogoLink } from "@/components/shared/LogoLink";
import { cn } from "@/lib/utils";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { NavItems } from "./NavItems";

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { navGroups, entitlements } = useAppNavigation();

  return (
    <aside className={cn(
      "flex flex-col h-screen border-r border-border bg-sidebar shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-56",
      className
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
        {collapsed ? (
          <div className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-col items-center gap-1">
                {group.items.map((item) => (
                  <NavItems key={item.href} navGroups={[{ label: "", items: [item] }]} entitlements={entitlements as unknown as Record<string, boolean>} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <NavItems navGroups={navGroups} entitlements={entitlements as unknown as Record<string, boolean>} />
        )}
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

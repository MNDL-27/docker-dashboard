import { cn } from "@/lib/utils";
import { Box, Square, RefreshCcw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DashboardContainerSummary } from "@/components/dashboard/dashboard-types";

interface ContainersTableProps {
  containers: DashboardContainerSummary[];
  isLoading?: boolean;
  className?: string;
}

export function ContainersTable({ containers, isLoading, className }: ContainersTableProps) {
  return (
    <div className={cn("glass-card overflow-hidden flex flex-col h-full", className)}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Active Containers</h3>
        </div>
        <Link to="/app/containers" className="text-[11px] font-bold text-primary hover:underline flex items-center">
          VIEW ALL <ExternalLink className="h-3 w-3 ml-0.5" />
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Container</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">CPU Usage</th>
              <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Memory</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-4 py-4 h-12 bg-white/[0.02]" />
                </tr>
              ))
            ) : containers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No containers found across connected hosts.
                </td>
              </tr>
            ) : (
              containers.slice(0, 10).map((container) => (
                <tr key={container.Id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold truncate max-w-[180px]">
                        {(container.Names?.[0] || "unknown").replace(/^\//, "")}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[180px]">
                        {container.Image}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          container.State === "running" ? "bg-success animate-pulse" : "bg-destructive",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          container.State === "running" ? "text-success" : "text-destructive",
                        )}
                      >
                        {container.State}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 w-24">
                      <span className="text-[10px] text-muted-foreground font-medium">-</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-muted-foreground">-</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


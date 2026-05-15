import { DockerHost } from "@/types/database";
import { cn } from "@/lib/utils";
import { Server, Activity, AlertCircle, CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { normalizeHostStatus } from "@/lib/host-health-state";

const STATUS_LABEL: Record<string, string> = {
  connected: "Healthy",
  stale: "Stale",
  error: "Error",
  unhealthy: "Unhealthy",
  down: "Down",
  disconnected: "Offline",
  unknown: "Unknown",
};

function statusColor(status: string) {
  switch (status) {
    case "connected":
      return { bg: "bg-success/10", text: "text-success" };
    case "stale":
    case "error":
      return { bg: "bg-warning/10", text: "text-warning" };
    default:
      return { bg: "bg-destructive/10", text: "text-destructive" };
  }
}

interface HostHealthGridProps {
  hosts: DockerHost[];
  className?: string;
}

export function HostHealthGrid({ hosts, className }: HostHealthGridProps) {
  return (
    <div className={cn("glass-card overflow-hidden flex flex-col h-full", className)}>
      <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
          <h3 className="text-xs sm:text-sm font-semibold tracking-tight truncate">Host Health</h3>
        </div>
        <Link to="/app/hosts" className="text-[10px] sm:text-[11px] font-bold text-primary hover:underline flex items-center shrink-0">
          MANAGE <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-0.5" />
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {hosts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full opacity-50">
            <Server className="h-8 w-8 mb-2 text-muted-foreground" />
            <p className="text-sm">No hosts connected</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {hosts.map((host) => {
              const normalized = normalizeHostStatus(host.status);
              const isHealthy = normalized === "connected";
              const isWarning = normalized === "stale" || normalized === "error";
              const colors = statusColor(normalized);
              const label = STATUS_LABEL[normalized] || "Unknown";

              return (
                <Link 
                  key={host.id} 
                  to={`/app/hosts/${host.id}`}
                  className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={cn("p-1 sm:p-1.5 rounded-lg shrink-0", colors.bg)}>
                      {isHealthy ? (
                        <CheckCircle2 className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", colors.text)} />
                      ) : isWarning ? (
                        <AlertTriangle className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", colors.text)} />
                      ) : (
                        <AlertCircle className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", colors.text)} />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-semibold group-hover:text-primary transition-colors truncate">{host.name}</span>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-bold tracking-wider truncate">
                        {host.os_info || "Linux"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 text-right shrink-0">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <Activity className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3", isHealthy ? "text-success" : "text-muted-foreground")} />
                        <span className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter", colors.text)}>
                          {label}
                        </span>
                      </div>
                      {host.last_seen_at && (
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                          Seen {new Date(host.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

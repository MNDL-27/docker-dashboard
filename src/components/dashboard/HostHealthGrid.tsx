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
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Host Health Overview</h3>
        </div>
        <Link to="/app/hosts" className="text-[11px] font-bold text-primary hover:underline flex items-center">
          MANAGE HOSTS <ChevronRight className="h-3 w-3 ml-0.5" />
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
                  className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-lg", colors.bg)}>
                      {isHealthy ? (
                        <CheckCircle2 className={cn("h-4 w-4", colors.text)} />
                      ) : isWarning ? (
                        <AlertTriangle className={cn("h-4 w-4", colors.text)} />
                      ) : (
                        <AlertCircle className={cn("h-4 w-4", colors.text)} />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">{host.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {host.os_info || "Linux"} • {host.connection_mode.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <Activity className={cn("h-3 w-3", isHealthy ? "text-success" : "text-muted-foreground")} />
                        <span className={cn("text-[10px] font-bold uppercase tracking-tighter", colors.text)}>
                          {label}
                        </span>
                      </div>
                      {host.last_seen_at && (
                        <span className="text-[10px] text-muted-foreground font-medium">
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

import { cn } from "@/lib/utils";
import { AlertTriangle, Info, ShieldAlert, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AlertItem } from "@/components/dashboard/dashboard-types";
import { Link } from "react-router-dom";

interface DashboardAlertsProps {
  alerts: AlertItem[];
  className?: string;
}

export function DashboardAlerts({ alerts, className }: DashboardAlertsProps) {
  return (
    <div className={cn("glass-card overflow-hidden flex flex-col h-full border-l-0 md:border-l border-white/5", className)}>
      <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <ShieldAlert className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
          <h3 className="text-[11px] sm:text-sm font-semibold uppercase tracking-wider truncate">Issues</h3>
        </div>
        <Badge variant="outline" className="text-[8px] sm:text-[9px] font-black uppercase text-destructive border-destructive/20 bg-destructive/5 px-1.5 py-0 h-4 shrink-0">
          {alerts.length} NEW
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center h-full opacity-50">
            <Info className="h-6 w-6 sm:h-8 sm:w-8 mb-1.5 sm:mb-2 text-muted-foreground" />
            <p className="text-xs sm:text-sm">No critical issues detected</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.href || "/app/alerts"}
                className="block p-3 sm:p-4 hover:bg-white/5 transition-colors cursor-pointer group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-0.5",
                    alert.severity === "error" ? "bg-destructive" : alert.severity === "warning" ? "bg-warning" : "bg-primary",
                  )}
                />
                <div className="flex items-start gap-2 sm:gap-3">
                  <div
                    className={cn(
                      "mt-0.5 p-0.5 sm:p-1 rounded-md shrink-0",
                      alert.severity === "error" ? "text-destructive" : alert.severity === "warning" ? "text-warning" : "text-primary",
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide group-hover:text-primary transition-colors truncate">{alert.title}</span>
                      <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 shrink-0">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {alert.timestamp}
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{alert.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 sm:p-3 border-t border-white/5">
        <Button asChild variant="ghost" className="w-full text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] h-7 sm:h-8 text-muted-foreground hover:text-primary">
          <Link to="/app/alerts">
          ALL EVENTS <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}


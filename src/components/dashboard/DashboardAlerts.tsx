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
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">Operational Issues</h3>
        </div>
        <Badge variant="outline" className="text-[9px] font-black uppercase text-destructive border-destructive/20 bg-destructive/5 px-1.5 py-0 h-4">
          {alerts.length} NEW
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center h-full opacity-50">
            <Info className="h-8 w-8 mb-2 text-muted-foreground" />
            <p className="text-sm">No critical issues detected</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.href || "/app/alerts"}
                className="block p-4 hover:bg-white/5 transition-colors cursor-pointer group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-0.5",
                    alert.severity === "error" ? "bg-destructive" : alert.severity === "warning" ? "bg-warning" : "bg-primary",
                  )}
                />
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-1 p-1 rounded-md",
                      alert.severity === "error" ? "text-destructive" : alert.severity === "warning" ? "text-warning" : "text-primary",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide group-hover:text-primary transition-colors">{alert.title}</span>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                        <Clock className="h-3 w-3" />
                        {alert.timestamp}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{alert.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5">
        <Button asChild variant="ghost" className="w-full text-[10px] font-black uppercase tracking-[0.2em] h-8 text-muted-foreground hover:text-primary">
          <Link to="/app/alerts">
          EXPLORE ALL EVENTS <ChevronRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}


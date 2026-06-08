import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string | number;
    type: "positive" | "negative" | "neutral";
  };
  status?: "success" | "warning" | "destructive" | "neutral";
  icon?: LucideIcon;
  className?: string;
}

export function KPICard({ 
  label, 
  value, 
  subtext, 
  trend, 
  status = "neutral", 
  icon: Icon, 
  className 
}: KPICardProps) {
  const statusColors = {
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/20 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  };

  const dotColors = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    neutral: "bg-muted-foreground",
  };

  return (
    <div className={cn("glass-card p-3 sm:p-4 flex flex-col justify-between min-h-[100px] sm:min-h-[120px] transition-all hover:border-primary/30 group", className)}>
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 shrink-0 rounded-full", dotColors[status])} />
          <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{label}</span>
        </div>
        {Icon && <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />}
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</span>
          {trend && (
            <div className={cn("flex items-center text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded shrink-0", 
              trend.type === "positive" ? "text-success bg-success/10" : 
              trend.type === "negative" ? "text-destructive bg-destructive/10" : 
              "text-muted-foreground bg-muted"
            )}>
              {trend.type === "positive" ? <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" /> : 
               trend.type === "negative" ? <ArrowDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" /> : null}
              {trend.value}
            </div>
          )}
        </div>
        {subtext && <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium mt-0.5 sm:mt-1">{subtext}</span>}
      </div>
    </div>
  );
}

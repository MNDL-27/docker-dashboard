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
    <div className={cn("glass-card p-4 flex flex-col justify-between min-h-[120px] transition-all hover:border-primary/30 group", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", dotColors[status])} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />}
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          {trend && (
            <div className={cn("flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded", 
              trend.type === "positive" ? "text-success bg-success/10" : 
              trend.type === "negative" ? "text-destructive bg-destructive/10" : 
              "text-muted-foreground bg-muted"
            )}>
              {trend.type === "positive" ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : 
               trend.type === "negative" ? <ArrowDownRight className="h-3 w-3 mr-0.5" /> : null}
              {trend.value}
            </div>
          )}
        </div>
        {subtext && <span className="text-[11px] text-muted-foreground font-medium mt-1">{subtext}</span>}
      </div>
    </div>
  );
}

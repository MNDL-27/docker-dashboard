import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({ label, value, change, changeType = "neutral", icon: Icon, className }: MetricCardProps) {
  return (
    <div className={cn("glass-card p-4 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {change && (
          <span className={cn("text-xs font-medium pb-0.5", {
            "text-success": changeType === "positive",
            "text-destructive": changeType === "negative",
            "text-muted-foreground": changeType === "neutral",
          })}>{change}</span>
        )}
      </div>
    </div>
  );
}

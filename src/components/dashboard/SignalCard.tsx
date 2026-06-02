import { Cpu, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignalCardProps {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "success" | "warning" | "destructive" | "neutral";
  progress?: number;
}

export function SignalCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  progress,
}: SignalCardProps) {
  const barTone = 
    tone === "destructive" ? "bg-destructive" : 
    tone === "warning" ? "bg-warning" : 
    tone === "success" ? "bg-primary" : 
    "bg-muted-foreground/40";
    
  const iconTone = 
    tone === "destructive" ? "text-destructive" : 
    tone === "warning" ? "text-warning" : 
    tone === "success" ? "text-primary" : 
    "text-muted-foreground";

  return (
    <div className="glass-card rounded-2xl sm:rounded-[28px] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="mt-2 sm:mt-4 text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-background/40 p-2 sm:p-3 shrink-0">
          <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", iconTone)} />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 sm:mt-5 h-1.5 sm:h-2 overflow-hidden rounded-full bg-white/5">
          <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-6 text-muted-foreground">{helper}</p>
    </div>
  );
}

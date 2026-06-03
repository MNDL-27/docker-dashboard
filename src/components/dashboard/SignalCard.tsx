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
    <div className="glass-card rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/40 p-2 shrink-0">
          <Icon className={cn("h-4 w-4", iconTone)} />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      <p className="mt-3 text-[10px] font-mono leading-relaxed text-muted-foreground uppercase tracking-wider">{helper}</p>
    </div>
  );
}

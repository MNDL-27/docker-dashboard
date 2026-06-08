import { cn } from "@/lib/utils";

type StatusType = "healthy" | "running" | "success" | "paid" | "resolved" |
  "warning" | "acknowledged" | "paused" |
  "critical" | "unhealthy" | "firing" | "failed" | "investigating" |
  "offline" | "exited" | "restarting" | "identified" |
  "info" | "owner" | "admin" | "member" | "active" | "invited" | "developer" | "viewer" | "billing" |
  "production" | "staging" | "development";

const statusStyles: Record<string, string> = {
  healthy: "bg-success/15 text-success border-success/20",
  running: "bg-success/15 text-success border-success/20",
  success: "bg-success/15 text-success border-success/20",
  paid: "bg-success/15 text-success border-success/20",
  resolved: "bg-success/15 text-success border-success/20",

  warning: "bg-warning/15 text-warning border-warning/20",
  acknowledged: "bg-warning/15 text-warning border-warning/20",
  paused: "bg-warning/15 text-warning border-warning/20",
  identified: "bg-warning/15 text-warning border-warning/20",

  critical: "bg-destructive/15 text-destructive border-destructive/20",
  unhealthy: "bg-destructive/15 text-destructive border-destructive/20",
  firing: "bg-destructive/15 text-destructive border-destructive/20",
  failed: "bg-destructive/15 text-destructive border-destructive/20",
  investigating: "bg-destructive/15 text-destructive border-destructive/20",

  offline: "bg-muted text-muted-foreground border-border",
  exited: "bg-muted text-muted-foreground border-border",

  restarting: "bg-primary/15 text-primary border-primary/20",
  info: "bg-primary/15 text-primary border-primary/20",

  owner: "bg-primary/15 text-primary border-primary/20",
  admin: "bg-warning/15 text-warning border-warning/20",
  member: "bg-muted text-muted-foreground border-border",
  active: "bg-success/15 text-success border-success/20",
  invited: "bg-primary/15 text-primary border-primary/20",
  developer: "bg-success/15 text-success border-success/20",
  viewer: "bg-muted text-muted-foreground border-border",
  billing: "bg-muted text-muted-foreground border-border",

  production: "bg-destructive/10 text-destructive border-destructive/20",
  staging: "bg-warning/10 text-warning border-warning/20",
  development: "bg-primary/10 text-primary border-primary/20",
};

const hasDot = ["healthy", "running", "warning", "critical", "unhealthy", "offline", "firing", "restarting", "exited", "paused", "active", "invited"];

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border capitalize",
      statusStyles[status] || "bg-muted text-muted-foreground border-border",
      className
    )}>
      {hasDot.includes(status) && (
        <span className={cn("w-1.5 h-1.5 rounded-full", {
          "bg-success animate-pulse-dot": ["healthy", "running", "active"].includes(status),
          "bg-warning": status === "warning" || status === "paused",
          "bg-destructive": ["critical", "unhealthy", "firing"].includes(status),
          "bg-muted-foreground": ["offline", "exited"].includes(status),
          "bg-primary": status === "restarting" || status === "invited",
        })} />
      )}
      {status}
    </span>
  );
}

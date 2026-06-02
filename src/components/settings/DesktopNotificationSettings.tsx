import { useState, useEffect } from "react";
import { Bell, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission } from "@/lib/browser-notifications";

export function DesktopNotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );

  const handleEnableDesktop = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const getStatusDisplay = () => {
    switch (permission) {
      case "granted":
        return {
          icon: ShieldCheck,
          title: "Active",
          desc: "Browser alerts are enabled for this device.",
          color: "text-success",
        };
      case "denied":
        return {
          icon: ShieldAlert,
          title: "Blocked",
          desc: "Your browser is blocking notifications. Enable them in your site settings to receive alerts.",
          color: "text-destructive",
        };
      default:
        return {
          icon: Shield,
          title: "Inactive",
          desc: "Real-time system alerts are not yet enabled for this browser.",
          color: "text-muted-foreground",
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 p-3 shrink-0">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">Desktop Notifications</h3>
            <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Experimental</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Receive real-time infrastructure alerts on your computer or phone, even when the dashboard is closed or minimized.
          </p>
          
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <status.icon className={`h-4 w-4 ${status.color}`} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider">{status.title}</p>
                <p className="text-[10px] text-muted-foreground">{status.desc}</p>
              </div>
            </div>
            
            {permission !== "granted" && (
              <Button 
                size="sm" 
                onClick={() => void handleEnableDesktop()}
                disabled={permission === "denied"}
                className="whitespace-nowrap h-8 text-[11px]"
              >
                {permission === "denied" ? "Check Site Settings" : "Enable Browser Alerts"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

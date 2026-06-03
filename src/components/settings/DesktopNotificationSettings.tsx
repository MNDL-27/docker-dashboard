import { useState, useEffect } from "react";
import { Bell, ShieldCheck, ShieldAlert, Shield, Send, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { requestNotificationPermission, sendNativeNotification } from "@/lib/browser-notifications";
import { toast } from "sonner";

export function DesktopNotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );

  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("browser_notifications_enabled");
    return saved === null ? true : saved === "true";
  });

  const handleToggleEnabled = (checked: boolean) => {
    setIsEnabled(checked);
    localStorage.setItem("browser_notifications_enabled", String(checked));
    if (checked) {
      toast.success("Browser notifications enabled");
    } else {
      toast.info("Browser notifications muted");
    }
  };

  const handleEnableDesktop = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      toast.success("Browser permissions granted!");
    }
  };

  const handleSendTest = () => {
    if (permission !== "granted") {
      toast.error("Please enable browser permissions first");
      return;
    }

    const n = sendNativeNotification("Test Notification", {
      body: "This is a test notification from DockerDash. It's working!",
    });

    if (n) {
      toast.success("Test notification sent");
    } else {
      toast.error("Failed to send notification. Check your browser settings.");
    }
  };

  const getStatusDisplay = () => {
    switch (permission) {
      case "granted":
        return {
          icon: ShieldCheck,
          title: "Authorized",
          desc: "Browser alerts are authorized for this device.",
          color: "text-success",
        };
      case "denied":
        return {
          icon: ShieldAlert,
          title: "Blocked",
          desc: "Your browser is blocking notifications. Enable them in your site settings.",
          color: "text-destructive",
        };
      default:
        return {
          icon: Shield,
          title: "Setup Required",
          desc: "Real-time system alerts are not yet authorized for this browser.",
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight">Desktop Notifications</h3>
              <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Experimental</span>
            </div>
            {permission === "granted" && (
              <div className="flex items-center gap-2">
                {isEnabled ? <Volume2 className="h-3 w-3 text-success" /> : <VolumeX className="h-3 w-3 text-muted-foreground" />}
                <Switch 
                  checked={isEnabled} 
                  onCheckedChange={handleToggleEnabled}
                  aria-label="Toggle notifications"
                />
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Receive real-time infrastructure alerts on your computer or phone, even when the dashboard is closed or minimized.
          </p>
          
          <div className="mt-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <status.icon className={`h-4 w-4 ${status.color}`} />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider">{status.title}</p>
                  <p className="text-[10px] text-muted-foreground">{status.desc}</p>
                </div>
              </div>
              
              {permission !== "granted" ? (
                <Button 
                  size="sm" 
                  onClick={() => void handleEnableDesktop()}
                  disabled={permission === "denied"}
                  className="whitespace-nowrap h-8 text-[11px]"
                >
                  {permission === "denied" ? "Check Site Settings" : "Enable Browser Alerts"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={!isEnabled}
                  className="h-8 text-[11px] gap-2"
                >
                  <Send className="h-3 w-3" />
                  Send Test
                </Button>
              )}
            </div>
            
            {permission === "granted" && !isEnabled && (
              <p className="text-[10px] text-warning flex items-center gap-2 px-1">
                <VolumeX className="h-3 w-3" />
                Notifications are currently muted. You will not receive desktop alerts.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

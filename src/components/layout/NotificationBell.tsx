import React, { useState } from "react";
import { Bell, Check, Info, AlertTriangle, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useNotifications, useDismissNotification, useDismissAllNotifications } from "../../hooks/useNotifications";
import { useViewerState } from "../../hooks/useViewerState";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Notification as DbNotification } from "../../types/database";
import { requestNotificationPermission } from "../../lib/browser-notifications";

const NotificationIcon = ({ type }: { type: DbNotification["type"] }) => {
  switch (type) {
    case "error":
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case "success":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "update":
      return <RefreshCw className="w-5 h-5 text-blue-500" />;
    default:
      return <Info className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />;
  }
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const { data: viewer } = useViewerState();
  const orgId = viewer?.active_org_id || null;
  
  const { data: notifications, unreadCount } = useNotifications(orgId);
  const dismissMutation = useDismissNotification(orgId);
  const dismissAllMutation = useDismissAllNotifications(orgId);
  const navigate = useNavigate();

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissMutation.mutate(id);
  };

  const handleDismissAll = () => {
    dismissAllMutation.mutate();
    setOpen(false);
  };

  const handleEnableDesktop = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const handleClick = (n: DbNotification) => {
    if (n.link) {
      setOpen(false);
      if (n.link.startsWith("http://") || n.link.startsWith("https://")) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else {
        navigate(n.link);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDismissAll}
              className="h-8 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              disabled={dismissAllMutation.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              You have no new notifications.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {notifications.map((n: DbNotification) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group",
                    n.link && "cursor-pointer"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {n.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-words">
                      {n.message}
                    </p>
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDismiss(n.id, e)}
                    >
                      <Check className="w-3.5 h-3.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

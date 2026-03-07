import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, ChevronDown, LogOut, Settings, User, Moon, Sun, Command } from "lucide-react";
import { organizations, projects, currentUser, notifications } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AppTopBar() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const unreadCount = notifications.filter(n => !n.read).length;
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = user?.user_metadata?.full_name || user?.email || currentUser.name;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
      {/* Left: Switchers */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors">
          <span className="font-medium">{organizations[0].name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="text-muted-foreground/40">/</span>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors">
          <span className="text-muted-foreground">{projects[0].name}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Center: Search */}
      <button className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary rounded-md border border-border hover:border-primary/30 transition-colors w-72">
        <Search className="h-3.5 w-3.5" />
        <span>Search hosts, containers...</span>
        <kbd className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-mono">
          <Command className="h-2.5 w-2.5 inline" />K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </Button>
          {showNotifications && (
            <div className="absolute right-0 top-10 w-80 bg-popover border border-border rounded-lg shadow-xl z-50 animate-fade-in">
              <div className="p-3 border-b border-border font-medium text-sm">Notifications</div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-border last:border-0 hover:bg-accent/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-10 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 animate-fade-in py-1">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-sm font-medium">{displayName}</div>
                <div className="text-xs text-muted-foreground">{user?.email || currentUser.email}</div>
              </div>
              <Link to="/app/settings" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                <Settings className="h-3.5 w-3.5" /><span>Settings</span>
              </Link>
              <Link to="/app/settings" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                <User className="h-3.5 w-3.5" /><span>Profile</span>
              </Link>
              <div className="border-t border-border my-1" />
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive w-full text-left">
                <LogOut className="h-3.5 w-3.5" /><span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

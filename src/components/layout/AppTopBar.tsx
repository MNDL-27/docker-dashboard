import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, ChevronDown, LogOut, Settings, User, Moon, Sun, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export function AppTopBar() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const { user, signOut } = useAuth();
  const { organizations, currentOrg, setCurrentOrgId } = useOrganization();
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const navigate = useNavigate();

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
      {/* Left: Org Switcher */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowOrgMenu(!showOrgMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <span className="font-medium">{currentOrg?.name || "No Organization"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showOrgMenu && organizations.length > 1 && (
            <div className="absolute left-0 top-10 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 animate-fade-in py-1">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => { setCurrentOrgId(org.id); setShowOrgMenu(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${org.id === currentOrg?.id ? "bg-accent/50 font-medium" : ""}`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
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
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowOrgMenu(false); }}
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
                <div className="text-xs text-muted-foreground">{user?.email}</div>
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

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Search, Command, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton, OrganizationSwitcher } from "@clerk/clerk-react";

export function AppTopBar() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
      {/* Left: Org Switcher */}
      <div className="flex items-center gap-2">
        <OrganizationSwitcher hidePersonal={true} />
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

        <div className="relative flex items-center h-8">
          <UserButton />
        </div>
      </div>
    </header>
  );
}

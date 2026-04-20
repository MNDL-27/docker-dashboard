import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Command, Moon, Sun, LayoutDashboard, Server, Box, ActivitySquare, Settings, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton, OrganizationSwitcher } from "@clerk/clerk-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const quickSearchItems = [
  { label: "Dashboard", path: "/app", keywords: "overview metrics", Icon: LayoutDashboard },
  { label: "Hosts", path: "/app/hosts", keywords: "servers docker", Icon: Server },
  { label: "Containers", path: "/app/containers", keywords: "images workload", Icon: Box },
  { label: "Alerts", path: "/app/alerts", keywords: "incidents monitoring", Icon: ActivitySquare },
  { label: "Settings", path: "/app/settings", keywords: "preferences config", Icon: Settings },
  { label: "Help", path: "/app/help", keywords: "support docs", Icon: LifeBuoy },
];

export function AppTopBar() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  const handleSearchNavigate = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <>
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 sticky top-0 z-30">
        {/* Left: Org Switcher */}
        <div className="flex items-center gap-2">
          <OrganizationSwitcher hidePersonal={true} />
        </div>

        {/* Center: Search */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary rounded-md border border-border hover:border-primary/30 transition-colors w-72"
          aria-label="Open quick search"
        >
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

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search hosts, containers, pages..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {quickSearchItems.map((item) => (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords}`}
                onSelect={() => handleSearchNavigate(item.path)}
              >
                <item.Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <CommandShortcut>{item.path.replace("/app", "App")}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

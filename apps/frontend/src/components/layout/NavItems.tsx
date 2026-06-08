import { Link, useLocation } from "react-router-dom";
import { Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SheetClose } from "@/components/ui/sheet";

interface NavItemsProps {
  navGroups: Array<{
    label: string;
    items: Array<{
      label: string;
      icon: LucideIcon;
      href: string;
      premiumKey?: string;
    }>;
  }>;
  entitlements?: Record<string, boolean>;
  isMobile?: boolean;
}

export function NavItems({ navGroups, entitlements, isMobile }: NavItemsProps) {
  const location = useLocation();

  const content = navGroups.map((group) => (
    <div key={group.label}>
      <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {group.label}
      </p>
      <div className="space-y-1">
        {group.items.map((item) => {
          const active = location.pathname === item.href || (item.href !== "/app" && location.pathname.startsWith(item.href));
          
          const link = (
            <Link
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.premiumKey && !entitlements?.[item.premiumKey as keyof typeof entitlements] && (
                <Lock className="h-3.5 w-3.5 ml-auto text-muted-foreground/60 shrink-0" />
              )}
            </Link>
          );

          if (isMobile) {
            return <SheetClose asChild key={item.href}>{link}</SheetClose>;
          }

          return <div key={item.href}>{link}</div>;
        })}
      </div>
    </div>
  ));

  return <>{content}</>;
}

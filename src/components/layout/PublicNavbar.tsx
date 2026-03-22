import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogoLink } from "@/components/shared/LogoLink";
import { Box } from "lucide-react";

export function PublicNavbar() {
  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <LogoLink forcePublic className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Box className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">DockerDash</span>
        </LogoLink>
        <div className="hidden md:flex items-center gap-6 ml-8">
          <Link to="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link to="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Security</Link>
          <Link to="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link to="/login"><Button size="sm">Start Free</Button></Link>
        </div>
      </div>
    </nav>
  );
}

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogoLink } from "@/components/shared/LogoLink";
import { Box, Menu, X } from "lucide-react";
import { isPreviewAuthBypassEnabled } from "@/lib/hostname";
import { useState } from "react";

const navLinks = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/security", label: "Security" },
  { to: "/docs", label: "Docs" },
];

export function PublicNavbar() {
  const authHref = isPreviewAuthBypassEnabled() ? "/app" : "/login";
  const signupHref = isPreviewAuthBypassEnabled() ? "/app" : "/sign-up";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <LogoLink forcePublic className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white shadow-sm shadow-primary/20">
            <Box className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg tracking-tight">DockerDash</span>
        </LogoLink>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 ml-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link to={authHref}><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link to={signupHref}>
            <Button size="sm" className="shadow-sm shadow-primary/20">Start free</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2 border-t border-border/40">
            <Link to={authHref} className="flex-1" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">Log in</Button>
            </Link>
            <Link to={signupHref} className="flex-1" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full">Start free</Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

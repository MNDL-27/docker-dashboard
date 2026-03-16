import { useClerk, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Box, ShieldCheck, LogOut, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function BetaGatePage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Box className="h-6 w-6 text-primary-foreground" />
          </div>
        </Link>

        {/* Shield icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">Private Beta</h1>
          <p className="text-muted-foreground leading-relaxed">
            Thanks for your interest! We're currently in a private beta and access
            is limited to approved accounts only.
          </p>
        </div>

        {/* User email card */}
        {email && (
          <div className="glass-card p-4 flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{email}</p>
            </div>
          </div>
        )}

        {/* Info */}
        <p className="text-sm text-muted-foreground">
          Your access request has been noted. We'll notify you at this email
          when your account is approved.
        </p>

        {/* Sign out */}
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

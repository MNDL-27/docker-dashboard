import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Box, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/50 p-4 text-center">
            <p className="text-sm text-foreground">
              Password reset via email is currently disabled.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Please contact your administrator to have your password reset manually.
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

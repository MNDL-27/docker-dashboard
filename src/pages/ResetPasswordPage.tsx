import { Link } from "react-router-dom";
import { Box } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Feature Disabled</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Password reset is currently disabled on this instance.
          </p>
        </div>
      </div>
    </div>
  );
}

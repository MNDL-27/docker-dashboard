import { SignIn } from "@clerk/clerk-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignIn routing="path" path="/login" forceRedirectUrl="/app" />
    </div>
  );
}

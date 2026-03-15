import { SignUp } from "@clerk/clerk-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </div>
  );
}

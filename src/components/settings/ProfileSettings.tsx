import { UserProfile } from "@clerk/clerk-react";

export function ProfileSettings() {
  return (
    <div className="space-y-6">
      <UserProfile routing="hash" />
    </div>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function ProfileSettings() {
  const { user, setSession } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const updatedUser = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName }),
      });
      // Update session with new user data
      const token = localStorage.getItem('auth_token');
      if (token) setSession(updatedUser, token);
      
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const initials = (user?.full_name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-lg">
      <div className="glass-card p-6 space-y-6">
        <h3 className="font-medium">Profile</h3>

        {/* Avatar (Supabase storage removed, using initials only for now) */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xl font-semibold">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Profile photo</p>
            <p className="text-xs text-muted-foreground">Avatar uploading is temporarily disabled.</p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
        </div>

        <Button onClick={handleSave} disabled={loading} size="sm">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

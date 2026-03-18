import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganizationList, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box, Building2, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STEPS = ["Create Organization", "Connect Host", "You're Ready"] as const;

type OnboardingState =
  | { phase: "form" }
  | { phase: "creating" }
  | { phase: "syncing" }
  | { phase: "done" };

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState("");
  const [state, setState] = useState<OnboardingState>({ phase: "form" });
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { getToken } = useAuth();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollForOrgSync = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30; // ~30 seconds at 1s intervals

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const token = await getToken();
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user?.has_orgs) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              resolve();
              return;
            }
          }
        } catch {
          // Ignore individual poll errors, keep trying
        }

        if (attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          reject(new Error("Organization sync timed out. Please refresh the page."));
        }
      }, 1000);
    });
  }, [getToken]);

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !createOrganization) return;
    setError(null);

    try {
      // Phase 1: Create org via Clerk
      setState({ phase: "creating" });
      await createOrganization({ name: orgName.trim() });

      // Phase 2: Poll for DB sync
      setState({ phase: "syncing" });
      await pollForOrgSync();

      // Phase 3: Done
      setState({ phase: "done" });
      toast({
        title: "Organization created",
        description: `"${orgName.trim()}" is ready to go.`,
      });
    } catch (err: any) {
      setState({ phase: "form" });
      setError(err?.message || "Failed to create organization. Please try again.");
    }
  };

  const currentStepIndex = state.phase === "done" ? 1 : 0;
  const isSubmitting = state.phase === "creating" || state.phase === "syncing";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Header Bar ── */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Box className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Watchtower</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                      ${i < currentStepIndex
                        ? "bg-primary text-primary-foreground"
                        : i === currentStepIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    {i < currentStepIndex ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-xs hidden sm:inline ${
                      i <= currentStepIndex ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-6 h-px ${
                      i < currentStepIndex ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* ── Step 0: Create Organization ── */}
          {state.phase === "form" && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                  Create your organization
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your organization is your team's workspace for managing
                  Docker infrastructure.
                </p>
              </div>

              <div className="glass-card p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name</Label>
                  <Input
                    id="org-name"
                    placeholder="e.g. Acme Cloud"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You can rename this later in settings.
                  </p>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateOrg}
                  disabled={!orgName.trim()}
                >
                  Create Organization
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Creating / Syncing State ── */}
          {isSubmitting && (
            <div className="animate-fade-in">
              <div className="glass-card p-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    {state.phase === "creating"
                      ? "Creating organization…"
                      : "Syncing your workspace…"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {state.phase === "creating"
                      ? `Setting up "${orgName.trim()}" in Clerk…`
                      : "Finishing setup. This usually takes a few seconds."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1 Placeholder: Done ── */}
          {state.phase === "done" && (
            <div className="animate-fade-in">
              <div className="glass-card p-10 text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">
                    Organization created!
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">"{orgName.trim()}"</span> is ready.
                    Next steps — connecting a Docker host — are coming soon.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  size="lg"
                  onClick={() => navigate("/app")}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

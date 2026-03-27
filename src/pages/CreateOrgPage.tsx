import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

export default function CreateOrgPage() {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setOrgName(name);
    setOrgSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 48),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: orgName.trim(), slug: orgSlug || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to create organization (${res.status})`);
      }

      navigate("/onboarding", { replace: true });
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground">
      <div className="flex h-full grow flex-col">
        <div className="flex flex-1 justify-center py-10 px-4">
          <div className="flex flex-col w-full max-w-[560px] flex-1">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-border px-4 py-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary/20 text-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <h2 className="text-foreground text-lg font-bold leading-tight tracking-tight">Onboarding</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate("/app", { replace: true })}
                className="flex items-center justify-center rounded-lg h-10 w-10 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                title="Skip onboarding"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            {/* Progress */}
            <div className="flex flex-col gap-3 px-4 mb-10">
              <div className="flex gap-6 justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-primary text-xs font-bold uppercase tracking-wider mb-1">Step 1 of 2</span>
                  <h3 className="text-foreground text-sm font-medium">Create Organization</h3>
                </div>
                <p className="text-muted-foreground text-sm font-semibold">50%</p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: "50%" }} />
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="mb-8">
                <h1 className="text-foreground text-3xl font-bold leading-tight mb-2">
                  Tell us about your organization
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Set up your workspace identity to get started. You can change these settings later.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Org Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-semibold flex items-center gap-2">
                    Organization Name
                    <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={handleNameChange}
                    placeholder="e.g. Acme Corp"
                    autoFocus
                    disabled={loading}
                    className="flex w-full rounded-lg border border-border bg-muted text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary h-12 px-4 text-base placeholder:text-muted-foreground transition-all outline-none"
                  />
                </div>

                {/* Workspace URL */}
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-semibold">
                    Workspace URL
                  </label>
                  <div className="flex items-center">
                    <div className="flex items-center h-12 px-4 rounded-l-lg border border-r-0 border-border bg-muted/50 text-muted-foreground text-sm font-medium whitespace-nowrap">
                      app.dockerdash.app/
                    </div>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="acme-corp"
                      disabled={loading}
                      className="flex w-full rounded-r-lg border border-border bg-muted text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary h-12 px-4 text-base placeholder:text-muted-foreground transition-all outline-none"
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Only lowercase letters, numbers, and hyphens allowed.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-xs text-destructive">{error}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-4">
                  <button
                    type="submit"
                    disabled={loading || !orgName.trim()}
                    className="flex w-full items-center justify-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 text-base font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Continue to Connect Host
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/app", { replace: true })}
                    className="flex w-full items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground h-12 px-6 text-sm font-medium hover:bg-muted transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="mt-12 flex flex-col items-center gap-4 text-center">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Data encrypted and stored securely
              </div>
              <div className="w-12 h-1 bg-border rounded-full" />
              <p className="text-muted-foreground text-xs max-w-xs">
                Need help setting up your organization?{" "}
                <a href="#" className="text-primary font-medium hover:underline">Chat with support</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRightLeft, Building2, Loader2, Server, Shield, Users } from "lucide-react";

interface AdminStats {
  totalOrgs: number;
  totalUsers: number;
  activeHosts: number;
}

interface SecretMigrationResult {
  success: boolean;
  activeKeyId: string;
  migratedCount: number;
  alreadyCurrentCount: number;
  failedCount: number;
  failures: Array<{ hostId: string; field: string; error: string }>;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await apiFetch('/admin/stats');
      if (res.error) throw new Error(res.error);
      return res.stats as AdminStats;
    },
    retry: false,
  });

  const migrateSecrets = useMutation({
    mutationFn: async () => {
      return await apiFetch('/admin/migrate-secrets', {
        method: 'POST',
      }) as SecretMigrationResult;
    },
    onSuccess: (result) => {
      toast({
        title: "Secret migration complete",
        description: `Active key ${result.activeKeyId}. Migrated ${result.migratedCount}, already current ${result.alreadyCurrentCount}, failed ${result.failedCount}.`,
        variant: result.failedCount > 0 ? "destructive" : "default",
      });
      refetch();
    },
    onError: (err: Error) => {
      toast({
        title: "Secret migration failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Admin" description="Platform administration and operations" breadcrumbs={[{ label: "Admin" }]} />
        <div className="glass-card p-12 text-center text-destructive">
          Failed to load admin operations. This page is restricted to platform admins.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Admin" description="Internal platform operations for the SaaS control plane" breadcrumbs={[{ label: "Admin" }]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Total Orgs" value={data?.totalOrgs ?? 0} icon={Building2} />
        <MetricCard label="Total Users" value={data?.totalUsers ?? 0} icon={Users} />
        <MetricCard label="Active Hosts" value={data?.activeHosts ?? 0} icon={Server} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Secret Rotation Operations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Re-encrypt stored Docker host credentials with the current backend active encryption key after a key rotation.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
            Use this after setting `APP_ENCRYPTION_ACTIVE_KEY_ID` and deploying the new key material in Netlify.
          </div>

          <Button onClick={() => migrateSecrets.mutate()} disabled={migrateSecrets.isPending} className="gap-2">
            {migrateSecrets.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Re-encrypt Stored Secrets
          </Button>
        </div>

        <div className="glass-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium">Use Cases</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This page is for platform-wide operations, not tenant self-service.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {[
              "Monitor top-level SaaS health across organizations, users, and connected hosts.",
              "Run secret-rotation maintenance without asking tenants to re-add hosts.",
              "Keep internal-only controls out of tenant navigation and tenant workflows.",
            ].map((text) => (
              <div key={text} className="flex items-start gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

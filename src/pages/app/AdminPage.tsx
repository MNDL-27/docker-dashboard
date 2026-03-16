import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { Building2, Users, Server, Shield, AlertTriangle, Flag, Headphones, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function AdminPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await apiFetch('/admin/stats');
      if (res.error) throw new Error(res.error);
      return res.stats;
    },
    retry: false
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Admin" description="Platform administration and operations" breadcrumbs={[{ label: "Admin" }]} />
        <div className="glass-card p-12 text-center text-destructive">
          Failed to load admin statistics. You may not have administrative privileges.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Admin" description="Platform administration and operations" breadcrumbs={[{ label: "Admin" }]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard label="Total Orgs" value={data?.totalOrgs ?? 0} icon={Building2} />
        <MetricCard label="Total Users" value={data?.totalUsers ?? 0} icon={Users} />
        <MetricCard label="Active Hosts" value={data?.activeHosts ?? 0} icon={Server} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Organizations */}
        <div className="glass-card p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">Detailed Directory Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Platform-wide administration tools for organizing tenants and troubleshooting infrastructure will appear here.
          </p>
        </div>

        {/* Admin Quick Links */}
        <div className="space-y-3">
          {[
            { icon: Shield, title: "Platform Security", desc: "Security scan results and policies" },
            { icon: AlertTriangle, title: "Platform Status", desc: "System health and incident history" },
            { icon: Flag, title: "Feature Flags", desc: "Manage feature rollouts" },
            { icon: Headphones, title: "Support Queue", desc: "Customer support tickets" },
          ].map(item => (
            <div key={item.title} className="glass-card p-4 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

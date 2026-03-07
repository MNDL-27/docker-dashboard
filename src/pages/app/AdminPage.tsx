import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Building2, Users, Server, CreditCard, Shield, AlertTriangle, Flag, Headphones } from "lucide-react";

const adminOrgs = [
  { name: "Acme Cloud", plan: "Team", hosts: 24, members: 12, status: "healthy" as const, mrr: "$79" },
  { name: "DevStack Inc", plan: "Pro", hosts: 8, members: 4, status: "healthy" as const, mrr: "$29" },
  { name: "CloudNine Labs", plan: "Enterprise", hosts: 120, members: 45, status: "warning" as const, mrr: "$499" },
  { name: "StartupXYZ", plan: "Free", hosts: 2, members: 1, status: "healthy" as const, mrr: "$0" },
];

export default function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Admin" description="Platform administration and operations" breadcrumbs={[{ label: "Admin" }]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Orgs" value="247" change="+12 this month" changeType="positive" icon={Building2} />
        <MetricCard label="Total Users" value="1,834" change="+89" changeType="positive" icon={Users} />
        <MetricCard label="Active Hosts" value="3,412" icon={Server} />
        <MetricCard label="MRR" value="$34.2K" change="+8%" changeType="positive" icon={CreditCard} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Organizations */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium mb-3">Customer Organizations</h3>
          <div className="space-y-2">
            {adminOrgs.map(org => (
              <div key={org.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{org.name}</div>
                  <div className="text-xs text-muted-foreground">{org.plan} • {org.hosts} hosts • {org.members} members</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{org.mrr}/mo</span>
                  <StatusBadge status={org.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Quick Links */}
        <div className="space-y-3">
          {[
            { icon: Shield, title: "Platform Security", desc: "Security scan results and policies", status: "All clear" },
            { icon: AlertTriangle, title: "Platform Status", desc: "System health and incident history", status: "Operational" },
            { icon: Flag, title: "Feature Flags", desc: "Manage feature rollouts", status: "12 active" },
            { icon: Headphones, title: "Support Queue", desc: "Customer support tickets", status: "3 open" },
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
              <span className="text-xs text-muted-foreground">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Database, Globe, Plus, Server, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardEmptyHostsStateProps {
  organizationName?: string;
}

export function DashboardEmptyHostsState({ organizationName }: DashboardEmptyHostsStateProps) {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <PageHeader title="Dashboard" description={organizationName || "Overview"} />
      <div className="glass-card p-16 text-center max-w-2xl mx-auto border-primary/10 bg-primary/[0.02]">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <Server className="h-16 w-16 text-primary relative z-10" />
        </div>
        <h2 className="text-2xl font-black mb-3 tracking-tight uppercase">Fleet is empty</h2>
        <p className="text-sm text-muted-foreground mb-10 max-w-sm mx-auto leading-relaxed">
          Infrastructure management starts with a bridge. Connect your first Docker host to surface real-time insights.
        </p>
        <Button asChild size="lg" className="gap-2 rounded-xl h-12 px-8 font-black uppercase tracking-widest shadow-xl shadow-primary/20 group">
          <Link to="/app/hosts">
            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
            Connect First Host
          </Link>
        </Button>
        <div className="mt-12 grid grid-cols-3 gap-8 opacity-40">
          <div className="flex flex-col items-center gap-2">
            <Globe className="h-6 w-6" />
            <span className="text-[10px] uppercase font-bold tracking-tighter">Multi-Region</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Database className="h-6 w-6" />
            <span className="text-[10px] uppercase font-bold tracking-tighter">Real-time Stats</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Terminal className="h-6 w-6" />
            <span className="text-[10px] uppercase font-bold tracking-tighter">SSH-over-HTTP</span>
          </div>
        </div>
      </div>
    </div>
  );
}


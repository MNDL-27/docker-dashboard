import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { Building2, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardNoOrganizationState() {
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <PageHeader title="Welcome" description="Set up your first organization to continue" />
      <div className="glass-card p-12 text-center max-w-md mx-auto border-dashed border-primary/20 bg-primary/5">
        <Building2 className="h-12 w-12 text-primary/40 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Create Your Organization</h2>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Organizations are the root of your fleet. Invite members, manage hosts, and isolate resources.
        </p>
        <Button asChild size="lg" className="w-full gap-2 rounded-xl font-bold shadow-lg shadow-primary/20">
          <Link to="/onboarding">
            <Plus className="h-5 w-5" />
            Start Onboarding
          </Link>
        </Button>
      </div>
    </div>
  );
}


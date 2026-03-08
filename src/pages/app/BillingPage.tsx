import { PageHeader } from "@/components/shared/PageHeader";
import { Construction } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing"
        breadcrumbs={[{ label: "Management" }, { label: "Billing" }]}
      />
      <div className="glass-card p-12 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium mb-1">Coming Soon</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Subscription management, usage tracking, and invoices are under development.
        </p>
      </div>
    </div>
  );
}

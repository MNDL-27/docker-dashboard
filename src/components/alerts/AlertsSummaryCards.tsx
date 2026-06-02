import { BellRing, ShieldAlert, Siren, Workflow } from "lucide-react";

import { KPICard } from "@/components/shared/KPICard";
import type { AlertsSummary } from "@/services/alerts-api";

export function AlertsSummaryCards({ summary }: { summary: AlertsSummary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <KPICard label="Active Alerts" value={summary.total_alerts} subtext="Currently firing or acknowledged" icon={BellRing} status={summary.total_alerts > 0 ? "warning" : "success"} />
      <KPICard label="Critical" value={summary.critical_alerts} subtext="Immediate operator attention" icon={Siren} status={summary.critical_alerts > 0 ? "destructive" : "neutral"} />
      <KPICard label="Enabled Rules" value={summary.enabled_rules} subtext="Organization-scoped automations" icon={Workflow} status={summary.enabled_rules > 0 ? "success" : "neutral"} />
      <KPICard label="Open Incidents" value={summary.open_incidents} subtext="Escalated investigation threads" icon={ShieldAlert} status={summary.open_incidents > 0 ? "warning" : "neutral"} />
    </div>
  );
}

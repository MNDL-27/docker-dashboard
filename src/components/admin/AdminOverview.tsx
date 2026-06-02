import { Loader2, Building2, Users, Server, Activity, UserX, Lock, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminOverview } from "@/hooks/useAdmin";
import { StatusPill } from "./AdminShared";
import { formatDate } from "./admin-utils";

export function AdminOverview() {
  const overviewQuery = useAdminOverview();

  if (overviewQuery.isLoading) {
    return (
      <div className="glass-card flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KPICard label="Active Now" value={overviewQuery.data?.metrics.active_users ?? 0} icon={Activity} />
        <KPICard label="Organizations" value={overviewQuery.data?.metrics.total_organizations ?? 0} icon={Building2} />
        <KPICard label="Users" value={overviewQuery.data?.metrics.total_users ?? 0} icon={Users} />
        <KPICard label="Active Hosts" value={overviewQuery.data?.metrics.active_hosts ?? 0} icon={Server} />
        <KPICard label="Suspended" value={overviewQuery.data?.metrics.suspended_users ?? 0} icon={UserX} />
        <KPICard label="Locked Orgs" value={overviewQuery.data?.metrics.locked_organizations ?? 0} icon={Lock} />
        <KPICard label="Quarantined Hosts" value={overviewQuery.data?.metrics.quarantined_hosts ?? 0} icon={AlertTriangle} />
      </div>

      <div className="glass-card p-5">
        <h3 className="mb-4 font-medium">Recent operations</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(overviewQuery.data?.recent_operations ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.operation_name}</TableCell>
                <TableCell>
                  <StatusPill active={!item.status.includes("error")} label={item.status} />
                </TableCell>
                <TableCell>
                  {item.scope_type ?? "global"}
                  {item.scope_id ? `:${item.scope_id}` : ""}
                </TableCell>
                <TableCell className="max-w-[420px] truncate">{item.reason}</TableCell>
                <TableCell>{formatDate(item.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

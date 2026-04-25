import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminHosts,
  useQuarantineAdminHost,
  useUnquarantineAdminHost,
  useMarkAdminHostNeedsReconnect,
} from "@/hooks/useAdmin";
import { StatusPill, formatDate, filterByQuery, AdminActionDialog } from "./AdminShared";
import type { AdminHostRow } from "@/types/admin";
import { normalizeHostStatus } from "@/lib/host-health-state";

export function AdminHostManagement() {
  const { toast } = useToast();
  const [hostQuery, setHostQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<null | {
    kind: string;
    targetId: string;
    title: string;
    description: string;
    confirmLabel: string;
  }>(null);

  const hostsQuery = useAdminHosts();
  const quarantineMutation = useQuarantineAdminHost();
  const unquarantineMutation = useUnquarantineAdminHost();
  const reconnectMutation = useMarkAdminHostNeedsReconnect();

  const hosts = filterByQuery(hostsQuery.data ?? [], hostQuery, [
    "name",
    "organization_name",
    "host_url",
    "status",
  ]) as AdminHostRow[];

  const pendingDialogSubmitting =
    quarantineMutation.isPending || unquarantineMutation.isPending || reconnectMutation.isPending;

  const runAction = async (reason: string) => {
    if (!pendingAction) return;
    try {
      switch (pendingAction.kind) {
        case "quarantine-host":
          await quarantineMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
        case "unquarantine-host":
          await unquarantineMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
        case "mark-needs-reconnect":
          await reconnectMutation.mutateAsync({ hostId: pendingAction.targetId, reason });
          break;
      }
      toast({ title: "Admin action completed" });
    } catch (error) {
      toast({
        title: "Admin action failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={hostQuery}
              onChange={(event) => setHostQuery(event.target.value)}
              placeholder="Search hosts"
              className="pl-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Host</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hosts.map((host) => (
              <TableRow key={host.id}>
                <TableCell>
                  <div className="font-medium">{host.name}</div>
                  <div className="text-xs text-muted-foreground">{host.host_url}</div>
                </TableCell>
                <TableCell>{host.organization_name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      active={!host.is_quarantined}
                      label={host.is_quarantined ? "Quarantined" : host.status}
                    />
                    {host.needs_reconnect ? <Badge variant="outline">Needs reconnect</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>{formatDate(host.last_seen_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPendingAction({
                          kind: host.is_quarantined ? "unquarantine-host" : "quarantine-host",
                          targetId: host.id,
                          title: host.is_quarantined ? "Unquarantine host" : "Quarantine host",
                          description: "Quarantined hosts are blocked from proxy and control operations.",
                          confirmLabel: host.is_quarantined ? "Unquarantine" : "Quarantine",
                        })
                      }
                    >
                      {host.is_quarantined ? "Unquarantine" : "Quarantine"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPendingAction({
                          kind: "mark-needs-reconnect",
                          targetId: host.id,
                          title: "Mark host as needs reconnect",
                          description:
                            "Use this when the host should be surfaced to support or tenant owners as requiring attention.",
                          confirmLabel: "Mark needs reconnect",
                        })
                      }
                    >
                      Mark Needs Reconnect
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminActionDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={pendingAction?.title ?? ""}
        description={pendingAction?.description ?? ""}
        confirmLabel={pendingAction?.confirmLabel ?? "Confirm"}
        submitting={pendingDialogSubmitting}
        onConfirm={runAction}
      />
    </div>
  );
}

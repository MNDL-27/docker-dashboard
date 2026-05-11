import { useState } from "react";
import { ArrowRightLeft, Loader2, Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminOrganizations,
  useAdminHosts,
  useAdminOperations,
  useRunAdminSecretMigration,
} from "@/hooks/useAdmin";
import { StatusPill } from "./AdminShared";
import { formatDate } from "./admin-utils";

export function AdminOperations() {
  const { toast } = useToast();
  const [migrationScope, setMigrationScope] = useState<{
    organization_id?: string;
    host_id?: string;
    dry_run?: boolean;
  }>({});
  const [reason, setReason] = useState("");

  const organizationsQuery = useAdminOrganizations();
  const hostsQuery = useAdminHosts();
  const operationsQuery = useAdminOperations();
  const migrateSecretsMutation = useRunAdminSecretMigration();

  const handleRunMigration = async () => {
    try {
      await migrateSecretsMutation.mutateAsync({ ...migrationScope, reason });
      toast({ title: "Migration operation recorded" });
      setReason("");
      setMigrationScope({});
    } catch (error) {
      toast({
        title: "Migration failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Secret migration</h3>
            <p className="text-sm text-muted-foreground">
              Re-encrypt Docker host secrets with the active backend key, globally or against a specific org or host.
            </p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Organization scope</Label>
            <Select
              value={migrationScope.organization_id ?? "all"}
              onValueChange={(value) =>
                setMigrationScope((current) => ({ ...current, organization_id: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {(organizationsQuery.data ?? []).map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Host scope</Label>
            <Select
              value={migrationScope.host_id ?? "all"}
              onValueChange={(value) =>
                setMigrationScope((current) => ({ ...current, host_id: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hosts</SelectItem>
                {(hostsQuery.data ?? []).map((host) => (
                  <SelectItem key={host.id} value={host.id}>
                    {host.name} ({host.organization_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this maintenance run is needed"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setMigrationScope((current) => ({ ...current, dry_run: !current.dry_run }))}
            >
              {migrationScope.dry_run ? "Disable dry run" : "Dry run next"}
            </Button>
            <Button disabled={migrateSecretsMutation.isPending || !reason.trim()} onClick={handleRunMigration}>
              {migrateSecretsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Run migration
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="mb-4 font-medium">Operation history</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(operationsQuery.data ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.operation_name}</div>
                  <div className="text-xs text-muted-foreground">{item.reason}</div>
                </TableCell>
                <TableCell>
                  <StatusPill active={!item.status.includes("error")} label={item.status} />
                </TableCell>
                <TableCell>
                  {item.scope_type ?? "global"}
                  {item.scope_id ? `:${item.scope_id}` : ""}
                </TableCell>
                <TableCell>{formatDate(item.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

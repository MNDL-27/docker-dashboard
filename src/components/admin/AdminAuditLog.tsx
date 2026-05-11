import { useAdminAuditLog } from "@/hooks/useAdmin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "./admin-utils";

export function AdminAuditLog() {
  const auditLogQuery = useAdminAuditLog();

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(auditLogQuery.data ?? []).map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.action}</TableCell>
              <TableCell>{entry.actor_email}</TableCell>
              <TableCell>
                {entry.target_type}:{entry.target_id}
              </TableCell>
              <TableCell className="max-w-[420px] truncate">{entry.reason}</TableCell>
              <TableCell>{formatDate(entry.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

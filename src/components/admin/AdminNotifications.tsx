import { useState } from "react";
import { format } from "date-fns";
import { Trash2, Plus, BellRing } from "lucide-react";

import { useAdminNotifications, useCreateAdminNotification, useDeleteAdminNotification } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusPill } from "./AdminShared";
import { toast } from "sonner";

export function AdminNotifications() {
  const { data: notifications, isLoading } = useAdminNotifications();
  const createMutation = useCreateAdminNotification();
  const deleteMutation = useDeleteAdminNotification();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [link, setLink] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [reason, setReason] = useState("");

  const handleCreate = async () => {
    if (!title || !message || !reason) {
      toast.error("Please fill in all required fields (title, message, reason)");
      return;
    }

    try {
      await createMutation.mutateAsync({
        title,
        message,
        type,
        link: link || null,
        organizationId: organizationId || null,
        reason,
      });
      toast.success("Notification created successfully");
      setIsCreateOpen(false);
      setTitle("");
      setMessage("");
      setLink("");
      setOrganizationId("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create notification");
    }
  };

  const handleDelete = async (id: string) => {
    const reasonForDeletion = window.prompt("Reason for deleting this notification:");
    if (!reasonForDeletion) return;

    try {
      await deleteMutation.mutateAsync({ id, reason: reasonForDeletion });
      toast.success("Notification deleted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete notification");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Global Notifications</h2>
          <p className="text-sm text-muted-foreground">Push notifications to all users or specific organizations</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Notification</DialogTitle>
              <DialogDescription>
                Push a new notification to users. Leave Organization ID empty for a global notification.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="E.g., Scheduled Maintenance" />
              </div>
              <div className="grid gap-2">
                <Label>Message *</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Details about the notification..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Organization ID (Optional)</Label>
                  <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="org_..." />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Link URL (Optional)</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid gap-2">
                <Label>Reason for Audit Log *</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being sent?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !title || !message || !reason}>
                {createMutation.isPending ? "Creating..." : "Create Notification"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="w-[200px]">Title</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading notifications...
                </TableCell>
              </TableRow>
            ) : notifications?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No active notifications found.
                </TableCell>
              </TableRow>
            ) : (
              notifications?.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <StatusPill 
                      label={notification.type} 
                      active={notification.type === 'info' || notification.type === 'success'} 
                      variant={notification.type === 'error' ? 'destructive' : notification.type === 'warning' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell className="font-medium truncate max-w-[200px]">{notification.title}</TableCell>
                  <TableCell className="truncate max-w-[300px]" title={notification.message}>{notification.message}</TableCell>
                  <TableCell>
                    {notification.organization_id ? (
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded">Org: {notification.organization_id.slice(0, 8)}...</span>
                    ) : (
                      <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">Global</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <BellRing className="h-3 w-3 mr-1" />
                      {notification.dismiss_count || 0} dismissals
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{format(new Date(notification.created_at), "MMM d, yyyy")}</div>
                    <div>by {notification.created_by_email || 'System'}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

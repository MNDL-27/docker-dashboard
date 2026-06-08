import { useState } from "react";
import { MessageSquareShare, Plus, Send, Settings2 } from "lucide-react";

import { SlackDestinationDialog } from "@/components/settings/SlackDestinationDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import type { SlackDestination } from "@/types/database";
import type { SlackDestinationFormValues } from "@/types/alerts";

function formatAttemptSummary(destination: SlackDestination) {
  const attempt = destination.latest_attempt;
  if (!attempt) return "No notifications sent yet";
  const status = attempt.succeeded ? "Success" : "Failed";
  const code = attempt.http_status ? ` (${attempt.http_status})` : "";
  const detail = attempt.error_summary ? ` - ${attempt.error_summary}` : "";
  return `${status}${code}${detail}`;
}

export function SlackDestinationsPanel({
  destinations,
  canManage,
  saving,
  testingId,
  onCreate,
  onUpdate,
  onTest,
}: {
  destinations: SlackDestination[];
  canManage: boolean;
  saving?: boolean;
  testingId?: string | null;
  onCreate: (values: SlackDestinationFormValues) => void;
  onUpdate: (id: string, values: Partial<SlackDestinationFormValues>) => void;
  onTest: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<SlackDestination | null>(null);

  const handleSubmit = (values: SlackDestinationFormValues) => {
    if (editingDestination) {
      onUpdate(editingDestination.id, values);
    } else {
      onCreate(values);
    }
    setOpen(false);
    setEditingDestination(null);
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Slack Notifications</h3>
            <p className="text-xs text-muted-foreground">Send real alert notifications to Slack channels using Incoming Webhooks.</p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => { setEditingDestination(null); setOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Slack destination
            </Button>
          ) : null}
        </div>

        {destinations.length === 0 ? (
          <EmptyState
            icon={MessageSquareShare}
            title="No Slack destinations yet"
            description="Add a Slack Incoming Webhook URL to send warning, error, and critical alerts into your team channel."
            actionLabel={canManage ? "Add Slack destination" : undefined}
            onAction={canManage ? () => { setEditingDestination(null); setOpen(true); } : undefined}
          />
        ) : (
          <div className="divide-y divide-border">
            {destinations.map((destination) => (
              <div key={destination.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{destination.name}</span>
                    <StatusBadge status={destination.enabled ? "running" : "paused"} />
                    {destination.latest_attempt ? (
                      <StatusBadge status={destination.latest_attempt.succeeded ? "success" : "failed"} />
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">{destination.webhook_url_preview}</div>
                  <div className="text-xs text-muted-foreground">{formatAttemptSummary(destination)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManage ? (
                    <>
                      <Button size="sm" variant="outline" disabled={testingId === destination.id} onClick={() => onTest(destination.id)}>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {testingId === destination.id ? "Testing..." : "Send test"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingDestination(destination); setOpen(true); }}>
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => onUpdate(destination.id, { enabled: !destination.enabled })}>
                        {destination.enabled ? "Disable" : "Enable"}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Read only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlackDestinationDialog
        open={open}
        onOpenChange={setOpen}
        destination={editingDestination}
        saving={saving}
        onSubmit={handleSubmit}
      />
    </>
  );
}

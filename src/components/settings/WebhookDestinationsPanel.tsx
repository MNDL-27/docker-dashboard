import { useState } from "react";
import { Copy, ExternalLink, KeyRound, Plus, Send, Settings2, Webhook } from "lucide-react";

import { WebhookDestinationDialog } from "@/components/settings/WebhookDestinationDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import type { WebhookDestination } from "@/types/database";
import type { WebhookDestinationFormValues } from "@/types/alerts";

function formatAttemptSummary(destination: WebhookDestination) {
  const attempt = destination.latest_attempt;
  if (!attempt) return "No deliveries yet";
  const status = attempt.succeeded ? "Success" : "Failed";
  const code = attempt.http_status ? ` (${attempt.http_status})` : "";
  const detail = attempt.error_summary ? ` - ${attempt.error_summary}` : "";
  return `${status}${code}${detail}`;
}

export function WebhookDestinationsPanel({
  destinations,
  canManage,
  saving,
  testingId,
  latestSecret,
  onCreate,
  onUpdate,
  onTest,
  onDismissSecret,
}: {
  destinations: WebhookDestination[];
  canManage: boolean;
  saving?: boolean;
  testingId?: string | null;
  latestSecret?: { destinationName: string; value: string } | null;
  onCreate: (values: WebhookDestinationFormValues) => void;
  onUpdate: (id: string, values: Partial<WebhookDestinationFormValues> & { regenerate_secret?: boolean }) => void;
  onTest: (id: string) => void;
  onDismissSecret: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<WebhookDestination | null>(null);

  const handleSubmit = (values: WebhookDestinationFormValues) => {
    if (editingDestination) {
      onUpdate(editingDestination.id, values);
    } else {
      onCreate(values);
    }
    setOpen(false);
    setEditingDestination(null);
  };

  const handleCopySecret = async () => {
    if (!latestSecret?.value) return;
    await navigator.clipboard.writeText(latestSecret.value);
  };

  return (
    <>
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Webhook Destinations</h3>
            <p className="text-xs text-muted-foreground">Organization-level endpoints used for outbound alert delivery and signed test sends.</p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => { setEditingDestination(null); setOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add destination
            </Button>
          ) : null}
        </div>

        {latestSecret ? (
          <div className="border-b border-border bg-primary/5 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium">Signing secret ready for {latestSecret.destinationName}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{latestSecret.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">This is only shown once. Copy it into your receiver before dismissing.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleCopySecret}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy secret
                </Button>
                <Button size="sm" variant="ghost" onClick={onDismissSecret}>Dismiss</Button>
              </div>
            </div>
          </div>
        ) : null}

        {destinations.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhook destinations yet"
            description="Add an organization-level endpoint to start sending signed alert deliveries and test events."
            actionLabel={canManage ? "Add destination" : undefined}
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
                  <div className="text-sm text-muted-foreground">
                    <a href={destination.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      {destination.url}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Secret preview: <span className="font-mono">{destination.signing_secret_preview}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatAttemptSummary(destination)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManage ? (
                    <>
                      <Button size="sm" variant="outline" disabled={testingId === destination.id} onClick={() => onTest(destination.id)}>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {testingId === destination.id ? "Testing..." : "Send test"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => onUpdate(destination.id, { regenerate_secret: true })}>
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                        Regenerate secret
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

      <WebhookDestinationDialog
        open={open}
        onOpenChange={setOpen}
        destination={editingDestination}
        saving={saving}
        onSubmit={handleSubmit}
      />
    </>
  );
}

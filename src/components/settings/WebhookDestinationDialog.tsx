import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { WebhookDestination } from "@/types/database";
import type { WebhookDestinationFormValues } from "@/types/alerts";

function toInitialValues(destination?: WebhookDestination | null): WebhookDestinationFormValues {
  return {
    name: destination?.name ?? "",
    url: destination?.url ?? "",
    enabled: destination?.enabled ?? true,
  };
}

export function WebhookDestinationDialog({
  open,
  onOpenChange,
  destination,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination?: WebhookDestination | null;
  saving?: boolean;
  onSubmit: (values: WebhookDestinationFormValues) => void;
}) {
  const [values, setValues] = useState<WebhookDestinationFormValues>(toInitialValues(destination));

  useEffect(() => {
    setValues(toInitialValues(destination));
  }, [destination, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{destination ? "Edit webhook destination" : "Add webhook destination"}</DialogTitle>
          <DialogDescription>
            Webhook destinations are organization-level endpoints used for machine-to-machine alert delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Primary incident router"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              value={values.url}
              onChange={(event) => setValues((current) => ({ ...current, url: event.target.value }))}
              placeholder="https://example.com/webhooks/dockerdash"
            />
            <p className="text-xs text-muted-foreground">
              Requests are signed with an HMAC SHA-256 signature using the destination secret.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Destination enabled</p>
              <p className="text-xs text-muted-foreground">Disabled destinations stay stored but won&apos;t receive alert deliveries.</p>
            </div>
            <Switch checked={values.enabled} onCheckedChange={(checked) => setValues((current) => ({ ...current, enabled: checked }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving || !values.name.trim() || !values.url.trim()}>
            {saving ? "Saving..." : destination ? "Save changes" : "Create destination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

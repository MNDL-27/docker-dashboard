import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SlackDestination } from "@/types/database";
import type { SlackDestinationFormValues } from "@/types/alerts";

function toInitialValues(destination?: SlackDestination | null): SlackDestinationFormValues {
  return {
    name: destination?.name ?? "",
    webhook_url: "",
    enabled: destination?.enabled ?? true,
  };
}

export function SlackDestinationDialog({
  open,
  onOpenChange,
  destination,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination?: SlackDestination | null;
  saving?: boolean;
  onSubmit: (values: SlackDestinationFormValues) => void;
}) {
  const [values, setValues] = useState<SlackDestinationFormValues>(toInitialValues(destination));

  useEffect(() => {
    setValues(toInitialValues(destination));
  }, [destination, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{destination ? "Edit Slack destination" : "Add Slack destination"}</DialogTitle>
          <DialogDescription>
            Add a Slack Incoming Webhook URL to send alert notifications into a Slack channel.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="slack-name">Name</Label>
            <Input
              id="slack-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ops channel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-webhook-url">Slack Incoming Webhook URL</Label>
            <Input
              id="slack-webhook-url"
              type="password"
              value={values.webhook_url}
              onChange={(event) => setValues((current) => ({ ...current, webhook_url: event.target.value }))}
              placeholder={destination ? "Leave blank to keep existing webhook URL" : "https://hooks.slack.com/services/..."}
            />
            <p className="text-xs text-muted-foreground">
              The webhook URL is stored encrypted and used to send alert messages to Slack.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Destination enabled</p>
              <p className="text-xs text-muted-foreground">Disabled Slack destinations stay stored but won&apos;t receive alert notifications.</p>
            </div>
            <Switch checked={values.enabled} onCheckedChange={(checked) => setValues((current) => ({ ...current, enabled: checked }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(values)} disabled={saving || !values.name.trim() || (!destination && !values.webhook_url.trim())}>
            {saving ? "Saving..." : destination ? "Save changes" : "Create destination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { BellRing, MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DiscordDestinationsPanel() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Discord Notifications</h3>
          <p className="text-xs text-muted-foreground">
            Route alert notifications into Discord channels using server webhooks.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled>
          Coming soon
        </Button>
      </div>

      <div className="flex flex-col items-start gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-secondary p-2.5 text-muted-foreground">
            <MessageCircleMore className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Discord support is planned</p>
            <p className="text-xs text-muted-foreground">
              The notifications surface now includes Discord. Delivery setup is not wired yet, so no Discord destinations can be created from the dashboard today.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" />
          Visible in UI
        </div>
      </div>
    </div>
  );
}

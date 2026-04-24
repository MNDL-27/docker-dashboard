import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function HostUpgradeDialog({
  open,
  onOpenChange,
  nodeLimit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeLimit: number | null;
}) {
  const displayLimit = nodeLimit ?? 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="rounded-full bg-warning/10 p-2.5">
              <Lock className="h-5 w-5 text-warning" />
            </div>
            Host Limit Reached
          </DialogTitle>
          <DialogDescription>
            Your current plan allows monitoring up to{" "}
            <strong className="text-foreground">{displayLimit} host{displayLimit === 1 ? "" : "s"}</strong>.
            Upgrade your plan to connect and monitor additional hosts.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild size="lg" className="w-full">
            <Link to="/app/billing" onClick={() => onOpenChange(false)}>
              Upgrade Plan
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

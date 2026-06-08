import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";

export function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

export function StatusPill({ active, label, variant }: { active: boolean; label: string; variant?: "default" | "secondary" | "destructive" | "outline" | "warning" }) {
  return <Badge variant={variant || (active ? "default" : "outline")}>{label}</Badge>;
}

export function AdminActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmValue,
  requireTypedConfirm = false,
  submitting,
  onConfirm,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmValue?: string;
  requireTypedConfirm?: boolean;
  submitting?: boolean;
  onConfirm: (reason: string) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [typedValue, setTypedValue] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setTypedValue("");
    }
  }, [open]);

  const typedOk = !requireTypedConfirm || !confirmValue || typedValue === confirmValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {extra}
          {requireTypedConfirm && confirmValue ? (
            <div className="space-y-2">
              <Label htmlFor="typed-confirm">Type <span className="font-mono">{confirmValue}</span> to confirm</Label>
              <Input id="typed-confirm" value={typedValue} onChange={(event) => setTypedValue(event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="admin-reason">Reason</Label>
            <Textarea id="admin-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required audit reason" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || !reason.trim() || !typedOk}
            onClick={async () => {
              await onConfirm(reason.trim());
              onOpenChange(false);
            }}
          >
            {submitting ? "Running..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onContinue: () => void;
}

/** Step 2 — celebration / success screen after verified connection. */
export function StepComplete({ onContinue }: Props) {
  const hasPendingPlan = !!sessionStorage.getItem("dockerdash_pending_plan");

  return (
    <div className="animate-fade-in w-full">
      <div className="glass-card-raised p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">You're all set!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your workspace is ready and your host is connected. Head to your dashboard to start monitoring.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <p className="text-xs text-primary">Host connection verified!</p>
        </div>

        <div className="pt-2">
          <Button
            className="w-full h-11 text-base gap-2"
            size="lg"
            onClick={onContinue}
          >
            {hasPendingPlan ? "Continue to Billing" : "Go to Dashboard"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBox } from "./ErrorBanner";

interface Props {
  orgName: string;
  onOrgNameChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
}

/** Step 0 — Organization creation form. */
export function StepCreateOrg({ orgName, onOrgNameChange, onSubmit, error }: Props) {
  return (
    <div className="animate-fade-in w-full">
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Create your organization
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Your organization is your team's workspace for managing Docker infrastructure.
        </p>
      </div>

      <div className="glass-card-raised p-8 space-y-6">
        <div className="space-y-3">
          <Label htmlFor="org-name" className="text-base font-medium">Organization name</Label>
          <Input
            id="org-name"
            placeholder="e.g. Acme Cloud"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            className="h-11"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            You can rename this later in settings.
          </p>
        </div>
        {error && <ErrorBox message={error} />}
        <Button className="w-full h-11 text-base" size="lg" onClick={onSubmit} disabled={!orgName.trim()}>
          Create Organization
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

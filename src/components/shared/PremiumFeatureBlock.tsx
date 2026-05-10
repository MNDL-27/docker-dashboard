import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface PremiumFeatureBlockProps {
  title: string;
  description: string;
  /** When true the children are rendered; when false or omitted the upgrade prompt is shown. */
  hasAccess?: boolean;
  children?: React.ReactNode;
}

export function PremiumFeatureBlock({ title, description, hasAccess, children }: PremiumFeatureBlockProps) {
  if (hasAccess && children) {
    return <>{children}</>;
  }

  return (
    <div className="glass-card p-10 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        {description}
      </p>
      <Button asChild size="lg" className="gap-2">
        <Link to="/app/billing">
          Upgrade Plan
        </Link>
      </Button>
    </div>
  );
}

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PremiumFeatureBlockProps {
  title?: string;
  description: string;
  /** When true the children are rendered; when false or omitted the upgrade prompt is shown. */
  hasAccess?: boolean;
  children?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
}

export function PremiumFeatureBlock({ 
  title, 
  description, 
  hasAccess, 
  children,
  showIcon = true,
  className
}: PremiumFeatureBlockProps) {
  if (hasAccess && children) {
    return <>{children}</>;
  }

  return (
    <div className={cn("glass-card p-10 text-center", className)}>
      {showIcon && (
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
      )}
      {title && <h3 className="text-xl font-semibold tracking-tight mb-2">{title}</h3>}
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

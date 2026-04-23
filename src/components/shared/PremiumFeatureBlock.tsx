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
    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-secondary/20">
      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
        <Lock className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        {description}
      </p>
      <Button asChild size="lg">
        <Link to="/app/billing">
          Upgrade Plan
        </Link>
      </Button>
    </div>
  );
}

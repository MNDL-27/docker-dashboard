import { Loader2 } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

/** Full-card loading spinner used during org creation, host saving, and connection testing. */
export function LoadingCard({ title, description }: Props) {
  return (
    <div className="animate-fade-in w-full">
      <div className="glass-card-raised p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

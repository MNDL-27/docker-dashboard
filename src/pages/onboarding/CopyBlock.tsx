import { useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/**
 * A code block with clipboard copy functionality.
 * Extracted from OnboardingPage for reuse.
 */
export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      )}
      <div className="bg-background border border-border rounded-lg p-3.5 font-mono text-xs leading-relaxed overflow-x-auto">
        <pre className="whitespace-pre-wrap break-all text-foreground/90">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

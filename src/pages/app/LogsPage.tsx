import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { logEntries } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Play, Pause } from "lucide-react";
import { useState } from "react";

const severityColors: Record<string, string> = {
  error: "text-destructive",
  warn: "text-warning",
  info: "text-primary",
  debug: "text-muted-foreground",
};

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [liveTail, setLiveTail] = useState(false);
  const [severity, setSeverity] = useState<string>("all");

  const filtered = logEntries
    .filter(l => severity === "all" || l.severity === severity)
    .filter(l => !search || l.message.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Log Explorer"
        description="Search and filter logs across all hosts and containers"
        breadcrumbs={[{ label: "Observability" }, { label: "Logs" }]}
        actions={
          <Button size="sm" variant={liveTail ? "default" : "outline"} onClick={() => setLiveTail(!liveTail)} className="gap-1.5">
            {liveTail ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {liveTail ? "Pause" : "Live Tail"}
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search logs..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
          {["all", "error", "warn", "info", "debug"].map(s => (
            <button key={s} onClick={() => setSeverity(s)} className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${severity === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden font-mono text-xs">
        {filtered.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-2 border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
            <span className="text-muted-foreground shrink-0 w-20">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={`shrink-0 w-12 font-semibold uppercase ${severityColors[log.severity]}`}>{log.severity}</span>
            <span className="text-muted-foreground shrink-0 w-28 truncate">{log.container}</span>
            <span className="text-foreground break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

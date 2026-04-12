import { useMemo, useState } from "react";
import { formatDistanceToNowStrict, parseISO, isValid } from "date-fns";
import { Search, AlertTriangle, Info, TerminalSquare, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type LogTone = "error" | "warning" | "info" | "neutral";

interface LogConsoleProps {
  logs: string[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
  heightClassName?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
}

interface ParsedLogLine {
  raw: string;
  message: string;
  timestamp: string | null;
  relativeTime: string | null;
  tone: LogTone;
}

function parseLogLine(line: string): ParsedLogLine {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[^\s]+)\s+(.*)$/);
  const timestamp = match?.[1] ?? null;
  const message = match?.[2] ?? line;
  const lower = message.toLowerCase();
  const parsedTimestamp = timestamp ? parseISO(timestamp) : null;
  const relativeTime =
    parsedTimestamp && isValid(parsedTimestamp)
      ? formatDistanceToNowStrict(parsedTimestamp, { addSuffix: true })
      : null;

  let tone: LogTone = "neutral";
  if (/\b(error|fatal|panic|exception|failed|traceback)\b/.test(lower)) {
    tone = "error";
  } else if (/\b(warn|warning|retry|timeout|deprecated)\b/.test(lower)) {
    tone = "warning";
  } else if (/\b(info|ready|started|listening|connected|healthy|ok)\b/.test(lower)) {
    tone = "info";
  }

  return { raw: line, message, timestamp, relativeTime, tone };
}

const toneStyles: Record<LogTone, string> = {
  error: "border-l-destructive/70 bg-destructive/[0.06]",
  warning: "border-l-warning/70 bg-warning/[0.06]",
  info: "border-l-primary/60 bg-primary/[0.05]",
  neutral: "border-l-border bg-transparent",
};

const toneBadgeStyles: Record<LogTone, string> = {
  error: "text-destructive bg-destructive/10 border-destructive/20",
  warning: "text-warning bg-warning/10 border-warning/20",
  info: "text-primary bg-primary/10 border-primary/20",
  neutral: "text-muted-foreground bg-secondary/70 border-border",
};

export function LogConsole({
  logs,
  loading = false,
  title = "Logs",
  emptyMessage = "No logs available.",
  heightClassName = "h-[520px]",
  onRefresh,
  refreshLabel = "Refresh",
}: LogConsoleProps) {
  const [search, setSearch] = useState("");
  const [timestampFilter, setTimestampFilter] = useState("");
  const [activeTone, setActiveTone] = useState<LogTone | null>(null);

  const parsedLogs = useMemo(() => logs.map(parseLogLine), [logs]);
  const filteredLogs = useMemo(() => {
    const messageNeedle = search.trim().toLowerCase();
    const timestampNeedle = timestampFilter.trim().toLowerCase();

    return parsedLogs.filter((line) => {
      const matchesTone = !activeTone || line.tone === activeTone;
      const matchesMessage = !messageNeedle || line.raw.toLowerCase().includes(messageNeedle);
      const matchesTimestamp =
        !timestampNeedle ||
        line.timestamp?.toLowerCase().includes(timestampNeedle) ||
        line.relativeTime?.toLowerCase().includes(timestampNeedle);

      return matchesTone && matchesMessage && matchesTimestamp;
    });
  }, [activeTone, parsedLogs, search, timestampFilter]);

  const severityCounts = useMemo(
    () =>
      parsedLogs.reduce(
        (acc, line) => {
          acc[line.tone] += 1;
          return acc;
        },
        { error: 0, warning: 0, info: 0, neutral: 0 } as Record<LogTone, number>,
      ),
    [parsedLogs],
  );

  const severityMeta: Array<{ tone: LogTone; label: string; count: number; icon: typeof XCircle }> = [
    { tone: "error", label: "errors", count: severityCounts.error, icon: XCircle },
    { tone: "warning", label: "warnings", count: severityCounts.warning, icon: AlertTriangle },
    { tone: "info", label: "info", count: severityCounts.info, icon: Info },
  ];

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-border bg-card/90 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TerminalSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">{title}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{filteredLogs.length} visible</span>
              <span>{logs.length} total</span>
              {severityMeta.map(({ tone, label, count, icon: Icon }) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setActiveTone((current) => (current === tone ? null : tone))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors",
                    toneBadgeStyles[tone],
                    activeTone === tone && "ring-1 ring-current",
                    activeTone && activeTone !== tone && "opacity-50",
                  )}
                  title={activeTone === tone ? `Clear ${label} filter` : `Filter to ${label}`}
                >
                  <Icon className="h-3 w-3" />
                  {count} {label}
                </button>
              ))}
              {activeTone ? (
                <button
                  type="button"
                  onClick={() => setActiveTone(null)}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
                >
                  Clear level
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[28rem]">
            <div className="relative min-w-[220px] flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter message text..."
                className="h-9 border-white/10 bg-background/70 pl-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={timestampFilter}
                onChange={(event) => setTimestampFilter(event.target.value)}
                placeholder="Filter timestamp or time ago..."
                className="h-9 border-white/10 bg-background/70 text-sm"
              />
              {onRefresh ? (
                <Button size="sm" variant="outline" onClick={onRefresh} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {refreshLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No log lines match the current filter.</div>
      ) : (
        <ScrollArea className={cn("bg-[linear-gradient(180deg,rgba(10,14,18,0.9),rgba(7,10,14,0.96))]", heightClassName)}>
          <div className="divide-y divide-white/5">
            {filteredLogs.map((line, index) => (
              <div
                key={`${line.raw}-${index}`}
                className={cn(
                  "grid grid-cols-[auto_1fr] gap-3 border-l-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03]",
                  toneStyles[line.tone],
                )}
              >
                <div className="flex min-w-0 flex-col items-end gap-1 text-right">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                    {String(index + 1).padStart(3, "0")}
                  </span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]", toneBadgeStyles[line.tone])}>
                    {line.tone}
                  </span>
                </div>

                <div className="min-w-0 space-y-1">
                  {line.timestamp ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                      <span>{line.timestamp}</span>
                      {line.relativeTime ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] tracking-[0.22em] text-muted-foreground">
                          {line.relativeTime}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-foreground/92">
                    {line.message}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

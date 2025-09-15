import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Container {
  Id: string;
  Names: string[];
  State?: string;
  Status?: string;
}

interface ContainerStats {
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  memory_percent?: number;
  [key: string]: any;
}

interface ContainerCardProps {
  container: Container;
  refreshInterval: number;
  apiBase: string;
}

export const ContainerCard = ({ container, refreshInterval, apiBase }: ContainerCardProps) => {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  const containerName = container.Names?.[0]?.replace(/^\//, '') || container.Id.slice(0, 12);

  // WebSocket connections
  const statsWs = useWebSocket(
    `${apiBase.replace(/^http/, 'ws')}/ws/stats?id=${container.Id}`,
    {
      onMessage: (data) => {
        try {
          const parsed = JSON.parse(data);
          setStats(parsed);
        } catch (err) {
          console.error('Failed to parse stats:', err);
        }
      }
    }
  );

  const logsWs = useWebSocket(
    `${apiBase.replace(/^http/, 'ws')}/ws/logs?id=${container.Id}`,
    {
      onMessage: (data) => {
        setLogs(prev => {
          const newLogs = [...prev, data];
          // Keep only last 100 lines
          return newLogs.slice(-100);
        });
      }
    }
  );

  // Send initial interval and update when it changes
  useEffect(() => {
    if (statsWs.readyState === WebSocket.OPEN) {
      statsWs.send(JSON.stringify({
        type: 'interval',
        interval: refreshInterval
      }));
    }
  }, [refreshInterval, statsWs.readyState, statsWs.send]);

  // Send interval configuration when WebSocket opens
  useEffect(() => {
    if (statsWs.status === 'connected') {
      statsWs.send(JSON.stringify({
        type: 'interval',
        interval: refreshInterval
      }));
    }
  }, [statsWs.status, statsWs.send, refreshInterval]);

  // Auto-scroll logs to bottom when new logs arrive, but only if user is at bottom
  useEffect(() => {
    if (isUserAtBottom && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isUserAtBottom]);

  // Track if user is at bottom of logs
  const handleLogsScroll = useCallback(() => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px tolerance
      setIsUserAtBottom(atBottom);
    }
  }, []);

  const formatMemory = (bytes: number | undefined) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  const formatCpuPercent = (percent: number | undefined) => {
    if (percent === undefined || percent === null) return 'N/A';
    return `${percent.toFixed(1)}%`;
  };

  return (
    <Card className="bg-dashboard-card hover:bg-dashboard-card-hover transition-colors duration-200 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-foreground flex items-center justify-between">
          <span className="truncate">{containerName}</span>
          <div className="flex gap-2 ml-2">
            <StatusBadge status={statsWs.status} label="Stats" />
            <StatusBadge status={logsWs.status} label="Logs" />
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Section */}
        <div className="bg-dashboard-stats rounded-md p-3">
          <h4 className="text-sm font-medium text-foreground mb-2">Stats</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">CPU:</span>
              <span className="ml-2 text-foreground font-mono">
                {formatCpuPercent(stats?.cpu_percent)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Memory:</span>
              <span className="ml-2 text-foreground font-mono">
                {stats ? `${formatMemory(stats.memory_usage)} / ${formatMemory(stats.memory_limit)}` : 'N/A'}
              </span>
            </div>
          </div>
          {stats?.memory_percent !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Memory Usage</span>
                <span>{stats.memory_percent.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(stats.memory_percent, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Logs Section */}
        <div className="bg-dashboard-logs rounded-md p-3">
          <h4 className="text-sm font-medium text-foreground mb-2">Logs</h4>
          <div 
            ref={logsContainerRef}
            onScroll={handleLogsScroll}
            className="h-32 overflow-y-auto text-xs font-mono text-muted-foreground bg-background/50 rounded border p-2 space-y-0.5"
          >
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground/60 py-4">
                {logsWs.status === 'connected' ? 'Waiting for logs...' : 'Connecting to logs...'}
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="break-all">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
          {!isUserAtBottom && (
            <button
              onClick={() => {
                setIsUserAtBottom(true);
                logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              ↓ Scroll to bottom
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

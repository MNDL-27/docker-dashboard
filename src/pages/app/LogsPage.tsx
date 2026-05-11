import { LogConsole } from "@/components/docker/LogConsole";
import { PageHeader } from "@/components/shared/PageHeader";
import { PremiumFeatureBlock } from "@/components/shared/PremiumFeatureBlock";
import { Button } from "@/components/ui/button";
import { FileText, Filter, Loader2, RefreshCw, Server, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { useOrganization } from "@clerk/react";
import { useDockerHosts } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { Link } from "react-router-dom";
import { useViewerState } from "@/hooks/useViewerState";

interface ContainerListItem {
  Id: string;
  Names?: string[];
  State?: string;
}

export default function LogsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: hosts = [] } = useDockerHosts(currentOrg?.id, { filterByPlan: true });
  const { data: viewer } = useViewerState();
  const hasAccess = viewer?.entitlements?.canUseLogs ?? false;
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [containers, setContainers] = useState<ContainerListItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const connectedHosts = hosts.filter(h => h.status === 'connected');

  const handleHostChange = async (hostId: string) => {
    setSelectedHost(hostId);
    setSelectedContainer("");
    setLogs([]);
    if (!hostId) { setContainers([]); return; }
    try {
      const data = await dockerApi.listContainers(hostId);
      setContainers(Array.isArray(data) ? data : []);
    } catch { setContainers([]); }
  };

  const handleFetchLogs = async () => {
    if (!selectedHost || !selectedContainer) return;
    setLoading(true);
    try {
      const data = await dockerApi.containerLogs(selectedHost, selectedContainer, 300);
      setLogs(data?.logs || []);
    } catch (e) {
      setLogs([`Error: ${e instanceof Error ? e.message : String(e)}`]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Log Explorer" description="View real container logs" breadcrumbs={[{ label: "Observability" }, { label: "Logs" }]} />

      <PremiumFeatureBlock
        title="Log Explorer is a paid feature"
        description="Upgrade to an Individual, Business, or Dedicated plan to view real-time container logs from your Docker hosts."
        hasAccess={hasAccess}
      >
        {connectedHosts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No connected hosts</h2>
            <p className="text-sm text-muted-foreground mb-4">Connect a Docker host first to view container logs.</p>
            <Link to="/app/hosts"><Button variant="outline">Go to Hosts</Button></Link>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,0.85fr)]">
              <div className="glass-card p-6">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-tight">Log source</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Select a connected host and container to fetch recent logs.</p>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Host</div>
                    <div className="relative">
                      <select
                        className="h-10 w-full rounded-xl border border-white/10 bg-background/60 px-3 text-sm"
                        value={selectedHost}
                        onChange={e => handleHostChange(e.target.value)}
                      >
                        <option value="">Select host...</option>
                        {connectedHosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Container</div>
                    <div className="relative">
                      <select
                        className="h-10 w-full rounded-xl border border-white/10 bg-background/60 px-3 text-sm"
                        value={selectedContainer}
                        onChange={e => setSelectedContainer(e.target.value)}
                        disabled={!selectedHost}
                      >
                        <option value="">Select container...</option>
                        {containers.map((c) => (
                          <option key={c.Id} value={c.Id.substring(0, 12)}>
                            {(c.Names?.[0] ?? c.Id.substring(0, 12)).replace(/^\//, '')} ({c.State})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button size="sm" onClick={handleFetchLogs} disabled={!selectedContainer || loading} className="w-full gap-1.5">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Fetch Logs
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-card p-6">
                  <div className="flex items-center gap-2">
                    <TerminalSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold tracking-tight">Log explorer</h3>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Logs are fetched on demand. Use the filters to focus on errors or specific timestamps.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    Severity, time window, and full-text filters are available once logs are loaded.
                  </div>
                </div>

                <div className="glass-card p-6">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold tracking-tight">Log retention</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Fetch window</span>
                      <span className="text-foreground">Last 300 lines</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Export</span>
                      <span className="text-foreground">Coming soon</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Live stream</span>
                      <span className="text-foreground">Planned</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {logs.length > 0 ? (
              <LogConsole
                logs={logs}
                loading={loading}
                title="Fetched Logs"
                emptyMessage='Click "Fetch Logs" to load container logs.'
                heightClassName="h-[600px]"
                onRefresh={handleFetchLogs}
                refreshLabel="Fetch Again"
              />
            ) : selectedContainer && !loading ? (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                Click "Fetch Logs" to load container logs.
              </div>
            ) : null}
          </>
        )}
      </PremiumFeatureBlock>
    </div>
  );
}

import { LogConsole } from "@/components/docker/LogConsole";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, FileText } from "lucide-react";
import { useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import { useDockerHosts } from "@/hooks/useDocker";
import { dockerApi } from "@/services/docker-api";
import { Link } from "react-router-dom";

export default function LogsPage() {
  const { organization: currentOrg } = useOrganization();
  const { data: hosts = [] } = useDockerHosts(currentOrg?.id);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [containers, setContainers] = useState<any[]>([]);
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
    } catch (e: any) {
      setLogs([`Error: ${e.message}`]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Log Explorer" description="View real container logs" breadcrumbs={[{ label: "Observability" }, { label: "Logs" }]} />

      {connectedHosts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No connected hosts</h2>
          <p className="text-sm text-muted-foreground mb-4">Connect a Docker host first to view container logs.</p>
          <Link to="/app/hosts"><Button variant="outline">Go to Hosts</Button></Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="h-8 px-3 text-sm bg-secondary border border-border rounded-md"
              value={selectedHost}
              onChange={e => handleHostChange(e.target.value)}
            >
              <option value="">Select host...</option>
              {connectedHosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select
              className="h-8 px-3 text-sm bg-secondary border border-border rounded-md"
              value={selectedContainer}
              onChange={e => setSelectedContainer(e.target.value)}
              disabled={!selectedHost}
            >
              <option value="">Select container...</option>
              {containers.map((c: any) => (
                <option key={c.Id} value={c.Id?.substring(0, 12)}>
                  {(c.Names?.[0] || c.Id?.substring(0, 12)).replace(/^\//, '')} ({c.State})
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleFetchLogs} disabled={!selectedContainer || loading} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Fetch Logs
            </Button>
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
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">Click "Fetch Logs" to load container logs.</div>
          ) : null}
        </>
      )}
    </div>
  );
}

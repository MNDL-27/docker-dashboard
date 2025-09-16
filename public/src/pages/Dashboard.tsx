import { useState, useEffect, useCallback } from 'react';
import { ContainerCard } from '@/components/ContainerCard';
import { RefreshIntervalSelect } from '@/components/RefreshIntervalSelect';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Container {
  Id: string;
  Names: string[];
  State?: string;
  Status?: string;
}

const Dashboard = () => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const { toast } = useToast();

  const getApiBase = useCallback(() => {
    const stored = localStorage.getItem('dockerDashboardConfig');
    if (stored) {
      const config = JSON.parse(stored);
      return config.apiBase || window.location.origin;
    }
    return window.location.origin;
  }, []);

  const fetchContainers = useCallback(async () => {
    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/containers`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setContainers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch containers';
      setError(errorMessage);
      toast({
        title: "Connection Error",
        description: errorMessage,
        variant: "destructive",
      });
      console.error('Failed to fetch containers:', err);
    } finally {
      setLoading(false);
    }
  }, [getApiBase, toast]);

  useEffect(() => {
    // Load default refresh interval from config
    const stored = localStorage.getItem('dockerDashboardConfig');
    if (stored) {
      const config = JSON.parse(stored);
      if (config.defaultRefreshInterval) {
        setRefreshInterval(config.defaultRefreshInterval);
      }
    }

    fetchContainers();
  }, [fetchContainers]);

  const handleRefreshIntervalChange = useCallback((interval: number) => {
    setRefreshInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-dashboard-header border-b border-border p-4">
          <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Docker Dashboard</h1>
          </div>
        </header>
        <main className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading containers...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-dashboard-header border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Docker Dashboard</h1>
          <div className="flex items-center gap-4">
            <RefreshIntervalSelect 
              value={refreshInterval} 
              onChange={handleRefreshIntervalChange}
            />
            <Link to="/config">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Config
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h3 className="text-destructive font-medium mb-1">Connection Error</h3>
            <p className="text-destructive/80 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchContainers}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        )}

        {containers.length === 0 && !error ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No containers found</h3>
              <p className="text-muted-foreground mb-4">
                No Docker containers are currently available. Make sure your Docker daemon is running and containers exist.
              </p>
              <Button onClick={fetchContainers}>
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {containers.map((container) => (
              <ContainerCard
                key={container.Id}
                container={container}
                refreshInterval={refreshInterval}
                apiBase={getApiBase()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
import { useQuery } from "@tanstack/react-query";

export interface FleetMetrics {
  time: string;
  cpu: number;
  memory: number;
}

// Support both formats: secrets.agentApiKey or direct agentApiKey
interface HostWithKey {
  host_url: string;
  secrets?: { agentApiKey?: string };
  agentApiKey?: string;
}

export function useFleetMetrics(hosts: HostWithKey[], refetchInterval = 10000) {
  return useQuery({
    queryKey: ['fleet-metrics'],
    queryFn: async (): Promise<FleetMetrics[]> => {
      if (!hosts || hosts.length === 0) {
        return [];
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      
      let totalCpu = 0;
      let totalMem = 0;
      let hostCount = 0;

      const fetchPromises = hosts.map(async (host) => {
        const url = host.host_url;
        // Support both secrets.agentApiKey and direct agentApiKey
        const apiKey = host.secrets?.agentApiKey || host.agentApiKey;
        
        if (!url || !apiKey) return null;

        try {
          const response = await fetch(`${url}/metrics`, {
            headers: {
              'X-Agent-Key': apiKey,
            },
          });
          
          if (!response.ok) return null;
          
          const data = await response.json();
          return { cpu: data.cpu || 0, memory: data.memory || 0 };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      
      results.forEach((result) => {
        if (result) {
          totalCpu += result.cpu;
          totalMem += result.memory;
          hostCount++;
        }
      });

      // Return single data point for real-time chart
      // The component will maintain history
      return [{
        time: timeStr,
        cpu: hostCount > 0 ? Math.round(totalCpu / hostCount) : 0,
        memory: hostCount > 0 ? Math.round(totalMem / hostCount) : 0,
      }];
    },
    refetchInterval,
    enabled: hosts.length > 0,
  });
}

export interface AlertItem {
  id: string;
  type: "host" | "container" | "system";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  timestamp: string;
  href?: string;
}

export interface DashboardContainerSummary {
  Id: string;
  State: string;
  Names?: string[];
  Image?: string;
  _hostId?: string;
  _hostName?: string;
}
export interface ContainerStatsItem {
  containerId: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  net_rx: number;
  net_tx: number;
}

export interface AlertItem {
  id: string;
  type: "host" | "container" | "system";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardContainerSummary {
  Id: string;
  State: string;
  Names?: string[];
  Image?: string;
}


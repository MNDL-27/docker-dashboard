import { apiFetch } from "@/lib/api";
import type { AlertEvent, AlertRule, Incident } from "@/types/database";
import type { AlertRuleFormValues } from "@/types/alerts";

export interface AlertsSummary {
  total_alerts: number;
  critical_alerts: number;
  enabled_rules: number;
  open_incidents: number;
}

export interface AlertsWorkspaceResponse {
  alerts: Array<AlertEvent & { href?: string }>;
  summary: AlertsSummary;
  role: string;
  can_manage: boolean;
}

export interface IncidentsResponse {
  incidents: Incident[];
  history: Array<AlertEvent & { href?: string }>;
}

export const alertsApi = {
  listAlerts: (params?: { severity?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.severity) search.set("severity", params.severity);
    if (params?.status) search.set("status", params.status);
    const query = search.toString();
    return apiFetch(`/alerts${query ? `?${query}` : ""}`) as Promise<AlertsWorkspaceResponse>;
  },
  acknowledgeAlert: (id: string) =>
    apiFetch("/alerts", {
      method: "POST",
      body: JSON.stringify({ id, action: "acknowledge" }),
    }) as Promise<AlertEvent>,
  resolveAlert: (id: string) =>
    apiFetch("/alerts", {
      method: "POST",
      body: JSON.stringify({ id, action: "resolve" }),
    }) as Promise<AlertEvent>,
  listRules: () => apiFetch("/alert-rules") as Promise<AlertRule[]>,
  createRule: (values: AlertRuleFormValues) =>
    apiFetch("/alert-rules", {
      method: "POST",
      body: JSON.stringify(values),
    }) as Promise<AlertRule>,
  updateRule: (id: string, values: Partial<AlertRuleFormValues>) =>
    apiFetch("/alert-rules", {
      method: "PATCH",
      body: JSON.stringify({ id, ...values }),
    }) as Promise<AlertRule>,
  listIncidents: () => apiFetch("/incidents") as Promise<IncidentsResponse>,
  createIncident: (source_alert_event_id: string, payload?: { title?: string; summary?: string; severity?: string }) =>
    apiFetch("/incidents", {
      method: "POST",
      body: JSON.stringify({ source_alert_event_id, ...payload }),
    }) as Promise<Incident>,
};

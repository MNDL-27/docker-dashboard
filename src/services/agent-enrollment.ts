import { apiFetch } from "@/lib/api";
import type { ConnectionMode, DockerHost } from "@/types/database";
import type { DockerHostPingResult } from "@/services/docker-api";

export interface CreateAgentEnrollmentInput {
  organizationId: string;
  hostName: string;
  hostUrl: string;
  connectionMode: ConnectionMode;
  dockerSocketPath?: string;
  cfServiceTokenId?: string;
  cfServiceTokenSecret?: string;
}

export interface AgentEnrollmentCreateResponse {
  session_id: string;
  enrollment_token: string;
  expires_at: string;
  install_command: string;
  verify_command: string;
  setup_summary: string;
  verify_summary: string;
  next_step_summary: string;
  mode_label: string;
  advanced_manual_command: string;
}

export interface AgentEnrollmentFinalizeResponse extends DockerHostPingResult {
  host: DockerHost;
  remediation_command: string | null;
  reason_code?: string | null;
}

export const agentEnrollmentApi = {
  create: (input: CreateAgentEnrollmentInput) =>
    apiFetch("/agent-enrollments", {
      method: "POST",
      body: JSON.stringify({
        organization_id: input.organizationId,
        host_name: input.hostName,
        host_url: input.hostUrl,
        connection_mode: input.connectionMode,
        docker_socket_path: input.dockerSocketPath || "/var/run/docker.sock",
        cf_service_token_id: input.cfServiceTokenId,
        cf_service_token_secret: input.cfServiceTokenSecret,
      }),
    }) as Promise<AgentEnrollmentCreateResponse>,

  finalize: (sessionId: string) =>
    apiFetch("/agent-enrollments/finalize", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }) as Promise<AgentEnrollmentFinalizeResponse>,
};

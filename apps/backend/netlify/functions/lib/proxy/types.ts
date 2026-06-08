export interface Host {
  id: string;
  host_url: string;
  connection_mode: string;
  docker_socket_path: string;
  organization_id: string;
  name: string;
  status?: string;
}

export interface HostSecrets {
  agent_api_key?: string;
  cf_service_token_id?: string;
  cf_service_token_secret?: string;
}

export interface AuthContext {
  userId: string;
  orgId: string | null;
  isPlatformAdmin: boolean;
}

export interface ProxyContext {
  host: Host;
  secrets: HostSecrets | null;
  auth: AuthContext;
  corsHeaders: Record<string, string>;
  createProblemResponse: (
    status: number,
    title: string,
    detail?: string,
    type?: string,
  ) => Response;
}

// Manual type definitions for tables added via migration

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export type ConnectionMode = 'agent' | 'cloudflare_tunnel';

export interface DockerHost {
  id: string;
  organization_id: string;
  name: string;
  host_url: string;
  connection_mode: ConnectionMode;
  docker_socket_path: string;
  status: string;
  docker_version: string | null;
  os_info: string | null;
  last_seen_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMemberProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

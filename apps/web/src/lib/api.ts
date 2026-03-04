import { deriveWebSocketBaseUrl, resolveApiBaseUrl } from './transport';

const API_BASE = resolveApiBaseUrl();

export const API_WS_BASE = deriveWebSocketBaseUrl(API_BASE);

interface ApiOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

interface ApiErrorPayload {
    error?: string;
    message?: string;
}

export interface AuthUser {
    id: string;
    email: string;
    name: string | null;
}

export interface OrganizationSummary {
    id: string;
    name: string;
    slug: string;
    role?: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface OrganizationMember {
    id: string;
    role: OrganizationRole;
    joinedAt: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        createdAt?: string;
    };
}

export interface OrganizationInvite {
    id: string;
    email: string;
    role: OrganizationRole;
    expiresAt: string;
    inviteUrl: string;
}

export interface HostEnrollmentTokenResponse {
    token: string;
    command: string;
    cloudUrl: string;
    expiresAt: string;
    projectId: string;
    projectName: string;
}

export type InventoryDensity = 'SIMPLE' | 'STANDARD' | 'DETAILED';

export interface InventoryFilters {
    search: string;
    statuses: string[];
    projectIds: string[];
    hostIds: string[];
}

export interface FleetHostSummary {
    id: string;
    name: string;
    hostname: string;
    status: 'ONLINE' | 'OFFLINE';
    lastSeen: string | null;
    containerCount: number;
    ipAddress: string | null;
    agentVersion: string | null;
    cpuCount: number | null;
    memoryTotalBytes: string | number | null;
    project: {
        id: string;
        name: string;
    };
}

export interface FleetContainerSummary {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    restartCount: number;
    dockerCreatedAt: string | null;
    labels: Record<string, string> | null;
    ports: Record<string, unknown> | null;
    networks: unknown;
    volumes: unknown;
}

export interface FleetInventoryResponse {
    fleetTotals: {
        hostCount: number;
        containerCount: number;
    };
    hosts: FleetHostSummary[];
}

const SELECTED_ORGANIZATION_KEY = 'docker-dashboard:selected-organization-id';
const INVENTORY_DENSITY_KEY = 'docker-dashboard:inventory-density';

function appendInventoryFilters(query: URLSearchParams, filters: InventoryFilters): void {
    if (filters.search.trim()) {
        query.set('search', filters.search.trim());
    }
    if (filters.statuses.length > 0) {
        query.set('statuses', filters.statuses.join(','));
    }
    if (filters.projectIds.length > 0) {
        query.set('projectIds', filters.projectIds.join(','));
    }
    if (filters.hostIds.length > 0) {
        query.set('hostIds', filters.hostIds.join(','));
    }
}

async function extractErrorMessage(res: Response): Promise<string> {
    const fallback = res.status === 401 ? 'Invalid credentials' : `HTTP ${res.status}`;
    const payload = await res.json().catch(() => null) as ApiErrorPayload | null;
    return payload?.error ?? payload?.message ?? fallback;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        throw new Error(await extractErrorMessage(res));
    }

    return res.json();
}

export async function fetchCurrentUser(): Promise<AuthUser> {
    const response = await apiFetch<{ user: AuthUser }>('/auth/me');
    return response.user;
}

export async function logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' });
}

export async function fetchOrganizations(): Promise<OrganizationSummary[]> {
    const response = await apiFetch<{ organizations: OrganizationSummary[] }>('/organizations');
    return response.organizations;
}

export async function createOrganization(name: string, slug?: string): Promise<OrganizationSummary> {
    const response = await apiFetch<{ organization: OrganizationSummary }>('/organizations', {
        method: 'POST',
        body: { name, ...(slug ? { slug } : {}) },
    });
    return response.organization;
}

export async function fetchOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiFetch<{ members: OrganizationMember[] }>(`/api/organizations/${organizationId}/members`);
    return response.members;
}

export async function createOrganizationInvite(
    organizationId: string,
    email: string,
    role: OrganizationRole
): Promise<OrganizationInvite> {
    const response = await apiFetch<{ invite: OrganizationInvite }>(`/api/organizations/${organizationId}/invite`, {
        method: 'POST',
        body: { email, role },
    });
    return response.invite;
}

export async function updateOrganizationMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole
): Promise<OrganizationMember> {
    const response = await apiFetch<{ member: OrganizationMember }>(
        `/api/organizations/${organizationId}/members/${memberId}`,
        {
            method: 'PATCH',
            body: { role },
        }
    );
    return response.member;
}

export async function removeOrganizationMember(organizationId: string, memberId: string): Promise<void> {
    await apiFetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
    });
}

export async function issueHostEnrollmentToken(
    organizationId: string,
    projectId: string
): Promise<HostEnrollmentTokenResponse> {
    return apiFetch<HostEnrollmentTokenResponse>('/api/hosts/tokens', {
        method: 'POST',
        body: { organizationId, projectId },
    });
}

export async function fetchFleetInventory(
    organizationId: string,
    filters: InventoryFilters
): Promise<FleetInventoryResponse> {
    const query = new URLSearchParams({ organizationId });

    if (filters.projectIds.length === 1) {
        query.set('projectId', filters.projectIds[0]);
    }

    return apiFetch<FleetInventoryResponse>(`/api/hosts?${query.toString()}`);
}

export async function fetchHostContainers(
    hostId: string,
    organizationId: string,
    filters: InventoryFilters
): Promise<FleetContainerSummary[]> {
    const query = new URLSearchParams({ organizationId });
    appendInventoryFilters(query, filters);
    const response = await apiFetch<{ containers: FleetContainerSummary[] }>(
        `/api/hosts/${hostId}/containers?${query.toString()}`
    );

    return response.containers;
}

export function getInventoryDensityPreference(): InventoryDensity {
    if (typeof window === 'undefined') {
        return 'DETAILED';
    }

    const value = window.localStorage.getItem(INVENTORY_DENSITY_KEY);
    if (value === 'SIMPLE' || value === 'STANDARD' || value === 'DETAILED') {
        return value;
    }

    return 'DETAILED';
}

export function setInventoryDensityPreference(value: InventoryDensity): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(INVENTORY_DENSITY_KEY, value);
}

export function getSelectedOrganizationId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.localStorage.getItem(SELECTED_ORGANIZATION_KEY);
}

export function setSelectedOrganizationId(organizationId: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(SELECTED_ORGANIZATION_KEY, organizationId);
}

export function clearSelectedOrganizationId(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.removeItem(SELECTED_ORGANIZATION_KEY);
}

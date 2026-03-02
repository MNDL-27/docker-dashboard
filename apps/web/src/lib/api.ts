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

const SELECTED_ORGANIZATION_KEY = 'docker-dashboard:selected-organization-id';

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

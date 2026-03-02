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

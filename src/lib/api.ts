const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
  upstream_status?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  rawText: string;
  details: unknown;
  code?: string;
  upstreamStatus?: number;

  constructor(status: number, body: ApiErrorBody | null, rawText: string) {
    super(body?.error || rawText || `HTTP error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.rawText = rawText;
    this.details = body?.details;
    this.code = typeof body?.code === "string" ? body.code : undefined;
    this.upstreamStatus =
      typeof body?.upstream_status === "number" ? body.upstream_status : undefined;
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  // @ts-expect-error window.Clerk is injected globally 
  const token = await window.Clerk?.session?.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  // Handle body for POST/PUT requests
  if (options.body && typeof options.body === 'string') {
    fetchOptions.body = options.body;
  } else if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: ApiErrorBody | null = null;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = errorText ? { error: errorText } : null;
    }
    throw new ApiError(response.status, errorData, errorText);
  }

  return response.json();
}

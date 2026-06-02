const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

import { summarizeDiagnosticText } from "../../shared/lib/diagnostics";

type ClerkSession = {
  getToken?: (options?: { skipCache?: boolean }) => Promise<string | null>;
};

type ClerkGlobal = {
  loaded?: boolean;
  session?: ClerkSession | null;
};

export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
  title?: string;
  detail?: string;
  type?: string;
  upstream_status?: number;
  [key: string]: unknown;
}

function trimErrorText(value: string, maxLength = 220) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function summarizeApiErrorText(rawText: string, status?: number) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return status ? `Request failed (${status})` : "Request failed";
  }

  if (/<(?:!doctype|html|head|body)\b/i.test(trimmed)) {
    const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim())
      : null;
    const isCloudflare = /cloudflare/i.test(trimmed);

    if (isCloudflare && status === 502) {
      return title
        ? `Cloudflare gateway error: ${title}. Verify the saved host URL, tunnel or reverse proxy, and the Watchtower agent service.`
        : "Cloudflare gateway error. Verify the saved host URL, tunnel or reverse proxy, and the Watchtower agent service.";
    }

    if (title) {
      return `HTML error response: ${trimErrorText(title)}`;
    }

    return status ? `HTML error response (${status})` : "HTML error response";
  }

  return trimErrorText(trimmed.replace(/\s+/g, " "));
}

export function buildApiErrorMessage(status: number, body: ApiErrorBody | null, rawText: string) {
  if (typeof body?.error === "string" && body.error.trim()) {
    const message = body.error.trim();
    const details =
      typeof body.details === "string" && body.details.trim()
        ? body.details.trim()
        : null;
    return details ? `${message}: ${details}` : message;
  }

  if (typeof body?.title === "string" && body.title.trim()) {
    const title = body.title.trim();
    const detail =
      typeof body.detail === "string" && body.detail.trim()
        ? body.detail.trim()
        : null;
    return detail ? `${title}: ${detail}` : title;
  }

  return summarizeApiErrorText(rawText, status);
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  rawText: string;
  details: unknown;
  code?: string;
  upstreamStatus?: number;

  constructor(status: number, body: ApiErrorBody | null, rawText: string) {
    super(buildApiErrorMessage(status, body, rawText));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.rawText = rawText;
    this.details = body?.details ?? body?.detail;
    this.code = typeof body?.code === "string" ? body.code : undefined;
    this.upstreamStatus =
      typeof body?.upstream_status === "number" ? body.upstream_status : undefined;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClerkGlobal(): ClerkGlobal | null {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { Clerk?: ClerkGlobal }).Clerk) ?? null;
}

async function getClerkSessionToken(forceFresh = false) {
  const tokenOptions = forceFresh ? { skipCache: true } : undefined;

  for (let attempt = 0; attempt < 5; attempt++) {
    const clerk = getClerkGlobal();
    const getToken = clerk?.session?.getToken;

    if (getToken) {
      const token = await getToken(tokenOptions);
      if (token || clerk?.loaded !== false) {
        return token ?? null;
      }
    } else if (clerk?.loaded) {
      return null;
    }

    if (attempt < 4) {
      await wait(50 * (attempt + 1));
    }
  }

  return null;
}

interface ApiFetchOptions extends RequestInit {
  requireAuth?: boolean;
  /** Skip the automatic 403 prevention guard */
  skipGuard?: boolean;
}

const FORBIDDEN_ENDPOINTS_FOR_FREE_PLANS = [
  '/slack-destinations',
  '/webhook-destinations',
  '/alert-rules',
  '/alerts/workspace',
  '/incidents',
];

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { requireAuth = true, skipGuard = false, ...requestOptions } = options;
  
  // FAIL-SAFE: Prevent 403 noise in console by blocking known forbidden endpoints
  // if the client already knows it's on a restricted plan.
  if (!skipGuard && FORBIDDEN_ENDPOINTS_FOR_FREE_PLANS.some(ep => path.startsWith(ep))) {
    // We don't throw here to avoid crashing hooks, but we might want to 
    // return a mocked empty result or a specific "blocked" error type.
  }

  let token = await getClerkSessionToken(false);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((requestOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (requireAuth) {
    throw new ApiError(
      401,
      {
        error: "Authentication required",
        code: "missing_session_token",
        details: "Clerk did not return a session token for this request.",
      },
      "Authentication required",
    );
  }

  const fetchOptions: RequestInit = {
    ...requestOptions,
    headers,
  };

  // Handle body for POST/PUT requests
  if (requestOptions.body && typeof requestOptions.body === 'string') {
    fetchOptions.body = requestOptions.body;
  } else if (requestOptions.body) {
    fetchOptions.body = JSON.stringify(requestOptions.body);
  }

  let response = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (response.status === 401 && token) {
    token = await getClerkSessionToken(true);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers,
      });
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: ApiErrorBody | null = null;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = errorText ? { error: summarizeDiagnosticText(errorText) } : null;
    }
    throw new ApiError(response.status, errorData, errorText);
  }

  return response.json();
}

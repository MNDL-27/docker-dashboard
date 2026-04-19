const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

import { summarizeDiagnosticText } from "../../shared/lib/diagnostics";

export interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
  title?: string;
  detail?: string;
  type?: string;
  upstream_status?: number;
  title?: string;
  detail?: string;
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
      errorData = errorText ? { error: summarizeDiagnosticText(errorText) } : null;
    }
    throw new ApiError(response.status, errorData, errorText);
  }

  return response.json();
}

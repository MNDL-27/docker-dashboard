const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: await response.text() };
    }
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

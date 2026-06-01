import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function sendHeartbeat(path: string) {
  const token = (window as unknown as { Clerk?: { session?: { getToken?: (opts?: { skipCache?: boolean }) => Promise<string | null> } } })?.Clerk?.session?.getToken;
  if (!token) return;

  token({ skipCache: false }).then((t) => {
    if (!t) return;
    fetch(`${API_BASE}/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  }).catch(() => {});
}

export function usePageViewTracking() {
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sendHeartbeat(location.pathname);

    intervalRef.current = setInterval(() => {
      sendHeartbeat(location.pathname);
    }, 60_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [location.pathname]);
}

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Build hash injected by the Vite build-version plugin.
 * During dev mode this will be "dev", so version polling is skipped.
 */
const BUILD_HASH = import.meta.env.VITE_BUILD_HASH ?? "dev";

/** How often to check for a new version (ms). Default: 60 seconds. */
const POLL_INTERVAL_MS = 60_000;

/** How long to wait after a fetch error before retrying (ms). */
const ERROR_BACKOFF_MS = 120_000;

interface VersionPayload {
  hash: string;
  builtAt: string;
}

/**
 * Polls `/version.json` in the background and returns `true` when a newer
 * build has been deployed and the user should reload.
 *
 * Skipped entirely in dev mode.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const check = useCallback(async () => {
    if (!activeRef.current) return;

    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        scheduleNext(ERROR_BACKOFF_MS);
        return;
      }
      const data: VersionPayload = await res.json();

      if (data.hash && data.hash !== BUILD_HASH) {
        setUpdateAvailable(true);
        // Stop polling once we know an update is available
        return;
      }
      scheduleNext(POLL_INTERVAL_MS);
    } catch {
      // Network error — retry later
      scheduleNext(ERROR_BACKOFF_MS);
    }
  }, []);

  function scheduleNext(delay: number) {
    if (!activeRef.current) return;
    timerRef.current = setTimeout(check, delay);
  }

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
    // Resume polling so the banner can re-appear later
    scheduleNext(POLL_INTERVAL_MS * 5);
  }, []);

  useEffect(() => {
    // Skip version checking in dev mode
    if (BUILD_HASH === "dev") return;

    // Give the app a few seconds to settle before the first check
    timerRef.current = setTimeout(check, 10_000);

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [check]);

  return { updateAvailable, reload, dismiss };
}

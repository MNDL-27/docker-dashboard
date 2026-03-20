/**
 * Hostname detection for subdomain-based routing.
 *
 * - `dockerdash.app`      → marketing (landing page)
 * - `app.dockerdash.app`  → product   (dashboard)
 * - `localhost` / dev     → all routes (unchanged behavior)
 */

const APP_SUBDOMAIN = 'app.dockerdash.app';

export function isAppSubdomain(): boolean {
  const host = window.location.hostname;

  // Local development – always show all routes (safe fallback)
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }

  return host === APP_SUBDOMAIN;
}

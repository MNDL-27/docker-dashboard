/**
 * Hostname detection for subdomain-based routing.
 *
 * - `dockerdash.app`         → marketing (landing page)
 * - `app.dockerdash.app`     → product   (dashboard)
 * - `docs.dockerdash.app`    → documentation
 * - `localhost` / dev        → all routes (unchanged behavior)
 */

const APP_SUBDOMAIN = 'app.dockerdash.app';
const DOCS_SUBDOMAIN = 'docs.dockerdash.app';

function isLocalDev(): boolean {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

export function isAppSubdomain(): boolean {
  if (isLocalDev()) return false;
  return window.location.hostname === APP_SUBDOMAIN;
}

export function isDocsSubdomain(): boolean {
  if (isLocalDev()) return false;
  return window.location.hostname === DOCS_SUBDOMAIN;
}

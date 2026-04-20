/**
 * Hostname detection for subdomain-based routing.
 *
 * - `dockerdash.app`     => marketing
 * - `app.dockerdash.app` => product
 * - `docs.dockerdash.app` => documentation
 * - `localhost` / dev    => local development
 * - `*.netlify.app`      => preview deploys
 */

const APP_SUBDOMAIN = "app.dockerdash.app";
const DOCS_SUBDOMAIN = "docs.dockerdash.app";
const NETLIFY_PREVIEW_SUFFIX = ".netlify.app";

export function isLocalDev(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

export function isNetlifyPreview(): boolean {
  return window.location.hostname.endsWith(NETLIFY_PREVIEW_SUFFIX);
}

export function isAppHost(): boolean {
  return isLocalDev() || isNetlifyPreview() || window.location.hostname === APP_SUBDOMAIN;
}

export function isAppSubdomain(): boolean {
  if (isLocalDev()) return false;
  return window.location.hostname === APP_SUBDOMAIN;
}

export function isDocsSubdomain(): boolean {
  if (isLocalDev()) return false;
  return window.location.hostname === DOCS_SUBDOMAIN;
}

export function getAppOrigin(): string {
  if (isLocalDev() || isNetlifyPreview()) {
    return window.location.origin;
  }

  return `https://${APP_SUBDOMAIN}`;
}

export function getPublicOrigin(): string {
  if (isLocalDev() || isNetlifyPreview()) {
    return window.location.origin;
  }

  return "https://dockerdash.app";
}

import React from "react";

/**
 * Enforces that product routes are only accessible on the app subdomain.
 * Redirects exactly to the matching path on the app subdomain.
 * Safe fallback for localhost development.
 */
export function RequireAppSubdomain({ children }: { children: React.ReactNode }) {
  const host = window.location.hostname;

  // Local development fallback
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return <>{children}</>;
  }

  if (host !== "app.dockerdash.app") {
    const targetUrl = `https://app.dockerdash.app${window.location.pathname}${window.location.search}`;
    window.location.replace(targetUrl);
    return null;
  }

  return <>{children}</>;
}

import React from "react";
import { getAppOrigin, isAppHost } from "@/lib/hostname";

/**
 * Enforces that product routes are only accessible on the app subdomain.
 * Redirects exactly to the matching path on the app subdomain.
 * Safe fallback for localhost development.
 */
export function RequireAppSubdomain({ children }: { children: React.ReactNode }) {
  if (isAppHost()) {
    return <>{children}</>;
  }

  const targetUrl = `${getAppOrigin()}${window.location.pathname}${window.location.search}`;
  window.location.replace(targetUrl);
  return null;

}

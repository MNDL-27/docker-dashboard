import React from "react";
import { useAuth } from "@clerk/clerk-react";

/**
 * Shared LogoLink that strictly controls cross-domain navigation rules.
 * 
 * - Logged out -> https://dockerdash.app (Apex public site)
 * - Logged in  -> https://app.dockerdash.app (Protected app)
 * 
 * Uses standard <a> tags instead of React Router <Link> to ensure that 
 * clicking the logo properly exits the current subdomain context and 
 * triggers a full cross-domain navigation, avoiding router sub-domain traps.
 */
export function LogoLink({ 
  className,
  children 
}: { 
  className?: string;
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  const isLocalDev = () => {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  };

  // Default to apex while auth loads to prevent wrong routing traps
  let targetUrl = isLocalDev() ? "/" : "https://dockerdash.app";

  if (isLoaded) {
    if (isSignedIn) {
      targetUrl = isLocalDev() ? "/app" : "https://app.dockerdash.app";
    } else {
      targetUrl = isLocalDev() ? "/" : "https://dockerdash.app";
    }
  }

  return (
    <a href={targetUrl} className={className}>
      {children}
    </a>
  );
}

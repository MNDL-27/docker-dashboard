import React from "react";
import { useAuth } from "@clerk/react";
import { getAppOrigin, getPublicOrigin, isLocalDev } from "@/lib/hostname";

/**
 * Shared LogoLink that controls cross-origin navigation rules.
 * 
 * - Logged out -> public origin
 * - Logged in  -> app origin
 * 
 * Uses standard <a> tags instead of React Router <Link> to ensure that 
 * clicking the logo properly exits the current subdomain context and 
 * triggers a full cross-domain navigation, avoiding router sub-domain traps.
 */
export function LogoLink({ 
  className,
  forcePublic,
  children 
}: { 
  className?: string;
  forcePublic?: boolean;
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  // Default to apex while auth loads to prevent wrong routing traps
  let targetUrl = isLocalDev() ? "/" : getPublicOrigin();

  if (forcePublic) {
    targetUrl = isLocalDev() ? "/" : getPublicOrigin();
  } else if (isLoaded) {
    if (isSignedIn) {
      targetUrl = isLocalDev() ? "/app" : getAppOrigin();
    } else {
      targetUrl = isLocalDev() ? "/" : getPublicOrigin();
    }
  }

  return (
    <a href={targetUrl} className={className}>
      {children}
    </a>
  );
}

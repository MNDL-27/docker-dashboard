import { createClerkClient } from "@clerk/backend";

export function getClerkConfig() {
  const config: {
    secretKey?: string;
    publishableKey?: string;
    jwtKey?: string;
  } = {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  };

  // Prefer server-side secret verification when a secret key is available.
  // A stale injected CLERK_JWT_KEY can otherwise force invalid local token checks.
  if (!config.secretKey && process.env.CLERK_JWT_KEY) {
    config.jwtKey = process.env.CLERK_JWT_KEY;
  }

  return config;
}

export const clerkClient = createClerkClient(getClerkConfig());

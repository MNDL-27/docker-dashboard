import { createClerkClient } from "@clerk/backend";

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  jwtKey: process.env.CLERK_JWT_KEY,
});

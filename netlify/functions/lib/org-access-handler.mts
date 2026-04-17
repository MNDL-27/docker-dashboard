import { sql } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { clerkClient } from "./clerk.mjs";
import {
  assertOrganizationMemberMutationAllowed,
  buildOrganizationAccessSummary,
  canManageOrganizationMembers,
  normalizeOrganizationRole,
  toClerkOrganizationRole,
  type OrganizationAccessInvitationItem,
  type OrganizationAccessMemberRow,
  type OrganizationRole,
} from "./org-access.mjs";
import { buildCorsHeaders } from "./security.mjs";

async function handleOrganizationAccessRequest(req: Request) {
  // Build secure CORS headers based on request origin
  const corsHeaders = buildCorsHeaders(req);
  
  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: corsHeaders });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/org-access/, "") || "/";
    const parts = path.split("/").filter(Boolean);

    if (req.method === "GET" && parts.length === 0) {
      return await getOrganizationAccess(req);
    }

    if (req.method === "POST" && parts.length === 1 && parts[0] === "invitations") {
      return await createInvitation(req);
    }

    if (req.method === "POST" && parts.length === 3 && parts[0] === "invitations" && parts[2] === "resend") {
      return await resendInvitation(req, parts[1]);
    }

    if (req.method === "DELETE" && parts.length === 2 && parts[0] === "invitations") {
      return await revokeInvitation(req, parts[1]);
    }

    if (req.method === "PATCH" && parts.length === 2 && parts[0] === "members") {
      return await updateMember(req, parts[1]);
    }

    if (req.method === "DELETE" && parts.length === 2 && parts[0] === "members") {
      return await deleteMember(req, parts[1]);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("access denied") ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
}

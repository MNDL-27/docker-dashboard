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

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function toIsoOrNull(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

function mapInvitation(invitation: {
  id: string;
  emailAddress: string;
  role: string;
  createdAt: number;
  expiresAt: number;
}): OrganizationAccessInvitationItem {
  return {
    id: invitation.id,
    email: invitation.emailAddress,
    role: normalizeOrganizationRole(invitation.role),
    created_at: new Date(invitation.createdAt).toISOString(),
    expires_at: toIsoOrNull(invitation.expiresAt),
    status: "invited",
  };
}

async function getRequesterRole(orgId: string, userId: string) {
  const memberships = await sql`
    SELECT role
    FROM organization_members
    WHERE organization_id = ${orgId} AND user_id = ${userId}
  `;
  if (memberships.length === 0) {
    throw new Error("Access denied");
  }
  return normalizeOrganizationRole(memberships[0].role);
}

async function getOrganizationMembers(orgId: string) {
  const members = await sql<OrganizationAccessMemberRow[]>`
    SELECT
      u.id AS user_id,
      u.clerk_user_id,
      u.email,
      u.full_name,
      u.avatar_url,
      om.role,
      om.created_at AS joined_at
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${orgId}
    ORDER BY lower(COALESCE(u.full_name, u.email)) ASC
  `;

  return members.map((member) => ({
    user_id: member.user_id,
    email: member.email,
    full_name: member.full_name,
    avatar_url: member.avatar_url,
    role: normalizeOrganizationRole(member.role),
    joined_at: new Date(member.joined_at).toISOString(),
    status: "active" as const,
  }));
}

async function getOrganizationInvitations(clerkOrgId: string) {
  const response = await clerkClient.organizations.getOrganizationInvitationList({
    organizationId: clerkOrgId,
    status: ["pending"],
    limit: 100,
  });

  return response.data.map(mapInvitation);
}

async function getOrganizationAccess(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const [role, members, invitations] = await Promise.all([
    getRequesterRole(auth.orgId, auth.userId),
    getOrganizationMembers(auth.orgId),
    getOrganizationInvitations(auth.clerkOrgId),
  ]);

  return new Response(
    JSON.stringify({
      role,
      can_manage_members: canManageOrganizationMembers(role),
      summary: buildOrganizationAccessSummary(members, invitations),
      members,
      invitations,
    }),
    { headers },
  );
}

async function createInvitation(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const requesterRole = await getRequesterRole(auth.orgId, auth.userId);
  if (!canManageOrganizationMembers(requesterRole)) {
    return new Response(JSON.stringify({ error: "Admin access required for active organization" }), { status: 403, headers });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = normalizeOrganizationRole(body?.role);

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers });
  }

  if (requesterRole !== "owner" && role === "owner") {
    return new Response(JSON.stringify({ error: "Only owners can invite other owners" }), { status: 403, headers });
  }

  const invitation = await clerkClient.organizations.createOrganizationInvitation({
    organizationId: auth.clerkOrgId,
    emailAddress: email,
    role: toClerkOrganizationRole(role),
    inviterUserId: auth.clerkUserId,
  });

  return new Response(JSON.stringify(mapInvitation(invitation)), { status: 201, headers });
}

async function revokeInvitation(req: Request, invitationId: string) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const requesterRole = await getRequesterRole(auth.orgId, auth.userId);
  if (!canManageOrganizationMembers(requesterRole)) {
    return new Response(JSON.stringify({ error: "Admin access required for active organization" }), { status: 403, headers });
  }

  const invitation = await clerkClient.organizations.revokeOrganizationInvitation({
    organizationId: auth.clerkOrgId,
    invitationId,
    requestingUserId: auth.clerkUserId,
  });

  return new Response(JSON.stringify(mapInvitation(invitation)), { headers });
}

async function resendInvitation(req: Request, invitationId: string) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const requesterRole = await getRequesterRole(auth.orgId, auth.userId);
  if (!canManageOrganizationMembers(requesterRole)) {
    return new Response(JSON.stringify({ error: "Admin access required for active organization" }), { status: 403, headers });
  }

  const existing = await clerkClient.organizations.getOrganizationInvitation({
    organizationId: auth.clerkOrgId,
    invitationId,
  });

  const recreated = await clerkClient.organizations.createOrganizationInvitation({
    organizationId: auth.clerkOrgId,
    emailAddress: existing.emailAddress,
    role: existing.role,
    inviterUserId: auth.clerkUserId,
  });

  await clerkClient.organizations.revokeOrganizationInvitation({
    organizationId: auth.clerkOrgId,
    invitationId,
    requestingUserId: auth.clerkUserId,
  });

  return new Response(JSON.stringify(mapInvitation(recreated)), { headers });
}

async function updateMember(req: Request, targetUserId: string) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const requesterRole = await getRequesterRole(auth.orgId, auth.userId);
  const body = await req.json().catch(() => ({}));
  const nextRole = normalizeOrganizationRole(body?.role);

  const membershipRows = await sql<OrganizationAccessMemberRow[]>`
    SELECT
      u.id AS user_id,
      u.clerk_user_id,
      u.email,
      u.full_name,
      u.avatar_url,
      om.role,
      om.created_at AS joined_at
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${auth.orgId} AND u.id = ${targetUserId}
  `;

  if (membershipRows.length === 0) {
    return new Response(JSON.stringify({ error: "Member not found" }), { status: 404, headers });
  }

  const member = membershipRows[0];
  if (!member.clerk_user_id) {
    return new Response(JSON.stringify({ error: "Member Clerk identity unavailable" }), { status: 400, headers });
  }

  const ownerCountRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM organization_members
    WHERE organization_id = ${auth.orgId} AND role = 'owner'
  `;
  const ownerCount = Number(ownerCountRows[0]?.count || "0");

  try {
    assertOrganizationMemberMutationAllowed({
      requesterRole,
      targetRole: member.role,
      nextRole,
      ownerCount,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden" }), { status: 403, headers });
  }

  await clerkClient.organizations.updateOrganizationMembership({
    organizationId: auth.clerkOrgId,
    userId: member.clerk_user_id,
    role: toClerkOrganizationRole(nextRole),
  });

  await sql`
    UPDATE organization_members
    SET role = ${nextRole}
    WHERE organization_id = ${auth.orgId} AND user_id = ${targetUserId}
  `;

  const [updatedMember] = await getOrganizationMembers(auth.orgId).then((members) => members.filter((item) => item.user_id === targetUserId));
  return new Response(JSON.stringify(updatedMember), { headers });
}

async function deleteMember(req: Request, targetUserId: string) {
  const auth = await requireAuth(req);
  if (!auth.orgId || !auth.clerkOrgId) {
    throw new Error("No active organization selected. Please select an organization.");
  }

  const requesterRole = await getRequesterRole(auth.orgId, auth.userId);
  const membershipRows = await sql<OrganizationAccessMemberRow[]>`
    SELECT
      u.id AS user_id,
      u.clerk_user_id,
      u.email,
      u.full_name,
      u.avatar_url,
      om.role,
      om.created_at AS joined_at
    FROM organization_members om
    JOIN users u ON u.id = om.user_id
    WHERE om.organization_id = ${auth.orgId} AND u.id = ${targetUserId}
  `;

  if (membershipRows.length === 0) {
    return new Response(JSON.stringify({ error: "Member not found" }), { status: 404, headers });
  }

  const member = membershipRows[0];
  if (!member.clerk_user_id) {
    return new Response(JSON.stringify({ error: "Member Clerk identity unavailable" }), { status: 400, headers });
  }

  const ownerCountRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM organization_members
    WHERE organization_id = ${auth.orgId} AND role = 'owner'
  `;
  const ownerCount = Number(ownerCountRows[0]?.count || "0");

  try {
    assertOrganizationMemberMutationAllowed({
      requesterRole,
      targetRole: member.role,
      ownerCount,
      isRemoval: true,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Forbidden" }), { status: 403, headers });
  }

  await clerkClient.organizations.deleteOrganizationMembership({
    organizationId: auth.clerkOrgId,
    userId: member.clerk_user_id,
  });

  await sql`
    DELETE FROM organization_members
    WHERE organization_id = ${auth.orgId} AND user_id = ${targetUserId}
  `;

  return new Response(JSON.stringify({ success: true, user_id: targetUserId }), { headers });
}

export async function handleOrganizationAccessRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
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

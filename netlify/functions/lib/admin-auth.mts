import { sql } from "./db.mjs";
import { requireAuth, type AppAuthContext } from "./auth.mjs";
import { ensureAdminSchema } from "./ensure-admin-schema.mjs";
import { isPlatformAdminEmail } from "./platform-admin.mjs";

export interface PlatformAdminContext {
  auth: AppAuthContext;
  actorEmail: string;
}

export async function requirePlatformAdmin(req: Request): Promise<PlatformAdminContext> {
  await ensureAdminSchema();
  const auth = await requireAuth(req, { requireOrg: false });
  const users = await sql<{ email: string }[]>`
    SELECT email
    FROM public.users
    WHERE id = ${auth.userId}
  `;

  const email = users[0]?.email ?? "";
  if (!isPlatformAdminEmail(email)) {
    throw new Error("Forbidden. Admin access required.");
  }

  return {
    auth,
    actorEmail: email,
  };
}

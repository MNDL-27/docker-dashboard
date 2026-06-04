import type { Config } from "@netlify/functions";
import { buildCorsHeaders } from './lib/security.mjs';
import { requireAuth } from "./lib/auth.mjs";
import { assertOrganizationWriteAllowed } from "./lib/access-controls.mjs";
import {
  createOrUpdateDedicatedDeployment,
  getCurrentDedicatedDeployment,
} from "./lib/dedicated-deployments.mjs";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
}


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildHeaders(req) });
  }

  try {
    const auth = await requireAuth(req, { requireOrg: false });
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname.endsWith("/current")) {
      const deployment = await getCurrentDedicatedDeployment(auth);
      return json(deployment);
    }

    if (req.method === "POST" && pathname.endsWith("/dedicated-deployments")) {
      if (!auth.orgId) {
        return json({ error: "Select an active organization before starting a dedicated deployment." }, { status: 409 });
      }

      await assertOrganizationWriteAllowed({
        organizationId: auth.orgId,
        isPlatformAdmin: auth.isPlatformAdmin,
      });

      const body = await req.json();
      const deployment = await createOrUpdateDedicatedDeployment(auth, body || {});
      return json(deployment, { status: 201 });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error: any) {
    const message = error?.message || "Request failed";
    const status =
      message.toLowerCase().includes("active organization")
        ? 409
        : message.toLowerCase().includes("locked")
          ? 403
          : 401;
    return json({ error: message }, { status });
  }
};

export const config: Config = {
  path: "/api/dedicated-deployments*",
};

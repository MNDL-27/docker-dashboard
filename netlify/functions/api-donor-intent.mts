import type { Config } from "@netlify/functions";

import { requireAuth } from "./lib/auth.mjs";
import { createDonorIntent, donorJsonHeaders } from "./lib/donor-billing.mjs";

const headers = donorJsonHeaders();

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const auth = await requireAuth(req);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    const nextReq = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({
        ...body,
        organization_id: body.organization_id || auth.orgId,
        payer_email: body.payer_email || auth.email,
      }),
    });

    return await createDonorIntent(nextReq);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create donor intent";
    const status = /unauthorized/i.test(message) ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
};

export const config: Config = {
  path: "/api/donor-intent",
};

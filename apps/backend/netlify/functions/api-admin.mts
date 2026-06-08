import type { Config } from "@netlify/functions";

import { handleAdminRequest } from "./lib/admin-handler.mjs";
import { buildCorsPreflightHeaders } from "./lib/security.mjs";

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsPreflightHeaders(req) });
  }
  return handleAdminRequest(req);
};

export const config: Config = {
  path: "/api/admin",
};

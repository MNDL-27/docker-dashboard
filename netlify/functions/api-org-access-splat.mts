import type { Config } from "@netlify/functions";

import { handleOrganizationAccessRequest } from "./lib/org-access-handler.mjs";

export default async (req: Request) => handleOrganizationAccessRequest(req);

export const config: Config = {
  path: "/api/org-access/*",
};

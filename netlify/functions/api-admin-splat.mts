import type { Config } from "@netlify/functions";

import { handleAdminRequest } from "./lib/admin-handler.mjs";

export default async (req: Request) => handleAdminRequest(req);

export const config: Config = {
  path: "/api/admin/*",
};

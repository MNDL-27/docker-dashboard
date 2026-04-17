import type { Config } from "@netlify/functions";

import { donorJsonHeaders, ingestDonorEvent, parseDonorWebhookEvent } from "./lib/donor-billing.mjs";

const headers = donorJsonHeaders();

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const rawBody = await req.text();
    const event = await parseDonorWebhookEvent("liberapay", req, rawBody);
    const result = await ingestDonorEvent(event);

    return new Response(JSON.stringify({ success: true, provider: "liberapay", ...result }), {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process liberapay webhook";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers });
  }
};

export const config: Config = {
  path: "/api/billing/webhook/liberapay",
};

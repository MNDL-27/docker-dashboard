import type { Config } from "@netlify/functions";

import { donorJsonHeaders, sendDueDonorReminders } from "./lib/donor-billing.mjs";

const headers = donorJsonHeaders();

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const cronSecret = (process.env.DONOR_REMINDER_CRON_SECRET || "").trim();
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret") || "";
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }
  }

  try {
    const result = await sendDueDonorReminders();
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200, headers });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to send donor reminders" }),
      { status: 500, headers },
    );
  }
};

export const config: Config = {
  path: "/api/donor-reminders",
};

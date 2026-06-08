import type { Config } from "@netlify/functions";

import { buildCorsHeaders } from './lib/security.mjs';
import { onboardingJsonHeaders, sendDueOnboardingReminders } from "./lib/onboarding-reminders.mjs";

const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: buildHeaders(req) });
  }

  const cronSecret = (process.env.DONOR_REMINDER_CRON_SECRET || "").trim();
  if (!cronSecret) {
    return new Response(
      JSON.stringify({ error: "Cron secret is not configured" }),
      { status: 503, headers: buildHeaders(req) },
    );
  }
  const provided = req.headers.get("x-cron-secret") || "";
  if (provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: buildHeaders(req) });
  }

  try {
    const result = await sendDueOnboardingReminders();

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: result.sent,
        reminders_scanned: result.scanned,
        errors: result.errors,
      }),
      { status: 200, headers: buildHeaders(req) },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to send onboarding reminders" }),
      { status: 500, headers: buildHeaders(req) },
    );
  }
};

export const config: Config = {
  path: "/api/onboarding-reminders",
};

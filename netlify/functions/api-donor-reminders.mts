import type { Config } from "@netlify/functions";

import { buildCorsHeaders } from './lib/security.mjs';
import { donorJsonHeaders, sendDueDonorReminders, sendDueDonorRevocations } from "./lib/donor-billing.mjs";

const headers = donorJsonHeaders();


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
    const remindersResult = await sendDueDonorReminders();
    const revocationsResult = await sendDueDonorRevocations();

    const combinedErrors = [
      ...(remindersResult.errors || []),
      ...(revocationsResult.errors || []),
    ];

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: remindersResult.sent,
        reminders_scanned: remindersResult.scanned,
        revocations_sent: revocationsResult.sent,
        revocations_scanned: revocationsResult.scanned,
        errors: combinedErrors.length > 0 ? combinedErrors : undefined,
      }),
      { status: 200, headers: buildHeaders(req) },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to send donor reminders" }),
      { status: 500, headers: buildHeaders(req) },
    );
  }
};

export const config: Config = {
  path: "/api/donor-reminders",
};

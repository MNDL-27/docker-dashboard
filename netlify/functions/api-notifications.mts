import type { Config, Context } from "@netlify/functions";
import { requireAuth } from "./lib/auth.mjs";
import { sql } from "./lib/db.mjs";
import { ensureNotificationsSchema } from "./lib/ensure-notifications-schema.mjs";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    await ensureNotificationsSchema();
    const auth = await requireAuth(req, { requireOrg: false });

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    // GET /api/notifications
    if (req.method === "GET") {
      // Fetch active notifications (global or org-specific) that haven't been dismissed by this user
      // and haven't expired
      const notifications = await sql`
        SELECT n.*
        FROM public.notifications n
        LEFT JOIN public.notification_dismissals d 
          ON n.id = d.notification_id AND d.user_id = ${auth.userId}
        WHERE (n.organization_id = ${auth.orgId} OR n.organization_id IS NULL)
          AND d.id IS NULL
          AND (n.expires_at IS NULL OR n.expires_at > now())
        ORDER BY n.created_at DESC
        LIMIT 50
      `;

      return new Response(JSON.stringify({ notifications }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // POST /api/notifications/:id/dismiss
    if (req.method === "POST" && pathSegments[pathSegments.length - 1] === "dismiss") {
      const notificationId = pathSegments[pathSegments.length - 2];
      
      const [notification] = await sql`
        SELECT id FROM public.notifications 
        WHERE id = ${notificationId} 
          AND (organization_id = ${auth.orgId} OR organization_id IS NULL)
      `;

      if (!notification) {
        return new Response(JSON.stringify({ error: "Notification not found or unauthorized" }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      
      await sql`
        INSERT INTO public.notification_dismissals (notification_id, user_id)
        VALUES (${notificationId}, ${auth.userId})
        ON CONFLICT (notification_id, user_id) DO NOTHING
      `;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // POST /api/notifications/dismiss-all
    if (req.method === "POST" && pathSegments[pathSegments.length - 1] === "dismiss-all") {
      // Get all active notifications for this org/global
      const notifications = await sql`
        SELECT n.id
        FROM public.notifications n
        LEFT JOIN public.notification_dismissals d 
          ON n.id = d.notification_id AND d.user_id = ${auth.userId}
        WHERE (n.organization_id = ${auth.orgId} OR n.organization_id IS NULL)
          AND d.id IS NULL
          AND (n.expires_at IS NULL OR n.expires_at > now())
      `;

      if (notifications.length > 0) {
        const insertData = notifications.map(n => ({
          notification_id: n.id,
          user_id: auth.userId
        }));

        await sql`
          INSERT INTO public.notification_dismissals ${sql(insertData)}
          ON CONFLICT (notification_id, user_id) DO NOTHING
        `;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("Notifications API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message?.includes('Unauthorized') || error.message?.includes('Sync pending') ? 401 : 500,
      headers: corsHeaders,
    });
  }
};

export const config: Config = {
  path: "/api/notifications/*",
};

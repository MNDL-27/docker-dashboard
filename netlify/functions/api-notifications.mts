import type { Config, Context } from "@netlify/functions";
import { verifyAuthToken } from "./lib/auth.mjs";
import { sql } from "./lib/db.mjs";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyAuthToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    // GET /api/notifications?organizationId=...
    if (req.method === "GET") {
      const organizationId = url.searchParams.get("organizationId");
      if (!organizationId) {
        return new Response(JSON.stringify({ error: "Missing organizationId" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Verify user is in the org
      const membership = await sql`
        SELECT role FROM public.organization_members
        WHERE organization_id = ${organizationId} AND user_id = ${user.sub}
      `;

      if (membership.length === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: corsHeaders,
        });
      }

      // Fetch active notifications (global or org-specific) that haven't been dismissed by this user
      // and haven't expired
      const notifications = await sql`
        SELECT n.*
        FROM public.notifications n
        LEFT JOIN public.notification_dismissals d 
          ON n.id = d.notification_id AND d.user_id = ${user.sub}
        WHERE (n.organization_id = ${organizationId} OR n.organization_id IS NULL)
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
      
      await sql`
        INSERT INTO public.notification_dismissals (notification_id, user_id)
        VALUES (${notificationId}, ${user.sub})
        ON CONFLICT (notification_id, user_id) DO NOTHING
      `;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // POST /api/notifications/dismiss-all
    if (req.method === "POST" && pathSegments[pathSegments.length - 1] === "dismiss-all") {
      const body = await req.json();
      const organizationId = body.organizationId;
      
      if (!organizationId) {
        return new Response(JSON.stringify({ error: "Missing organizationId" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Get all active notifications for this org/global
      const notifications = await sql`
        SELECT n.id
        FROM public.notifications n
        LEFT JOIN public.notification_dismissals d 
          ON n.id = d.notification_id AND d.user_id = ${user.sub}
        WHERE (n.organization_id = ${organizationId} OR n.organization_id IS NULL)
          AND d.id IS NULL
          AND (n.expires_at IS NULL OR n.expires_at > now())
      `;

      if (notifications.length > 0) {
        const insertData = notifications.map(n => ({
          notification_id: n.id,
          user_id: user.sub
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
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const config: Config = {
  path: "/api/notifications/*",
};

import { Webhook } from 'svix';
import { sql } from './lib/db.mjs';

const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!webhookSecret) {
    console.error('Missing CLERK_WEBHOOK_SIGNING_SECRET');
    return new Response('Internal Server Error', { status: 500 });
  }

  // Get headers
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get body
  const payload = await req.text();

  // Verify webhook
  let evt: any;
  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const email = evt.data.email_addresses?.[0]?.email_address;
      const firstName = evt.data.first_name || '';
      const lastName = evt.data.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const avatarUrl = evt.data.image_url;

      if (!email) {
        throw new Error('No email found for user');
      }

      await sql`
        INSERT INTO public.users (clerk_user_id, email, full_name, avatar_url)
        VALUES (${id}, ${email}, ${fullName}, ${avatarUrl})
        ON CONFLICT (clerk_user_id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = now()
      `;

      // Auto-approve if email is in beta allowlist (case-insensitive)
      if (eventType === 'user.created') {
        const allowed = await sql`
          SELECT 1 FROM beta_allowlist WHERE lower(email) = lower(${email})
        `;
        if (allowed.length > 0) {
          await sql`UPDATE users SET is_approved = true WHERE clerk_user_id = ${id}`;
          console.log(`Auto-approved beta user ${id} (${email})`);
        } else {
          console.log(`User ${id} (${email}) signed up but is NOT in beta allowlist`);
        }
      }

      console.log(`Synced user ${id} (${email})`);
    } 
    else if (eventType === 'organization.created' || eventType === 'organization.updated') {
      const name = evt.data.name;
      const slug = evt.data.slug;
      const creatorClerkId = evt.data.created_by;
      
      let creatorId = null;
      if (creatorClerkId) {
        const creatorData = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${creatorClerkId}`;
        if (creatorData.length > 0) {
          creatorId = creatorData[0].id;
        }
      }

      // If we don't have the creator locally yet for some reason, we can't reliably set "created_by" 
      // without breaking FK constraint if this is an INSERT. We will skip it or use a default if need be.
      // But usually user.created fires before organization.created.

      await sql`
        INSERT INTO public.organizations (clerk_org_id, name, slug, created_by)
        VALUES (${id}, ${name}, ${slug}, ${creatorId})
        ON CONFLICT (clerk_org_id) DO UPDATE
        SET name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            updated_at = now()
      `;
      console.log(`Synced org ${id} (${name})`);
    }
    else if (eventType === 'organizationMembership.created') {
      const organizationId = evt.data.organization.id;
      const publicUserData = evt.data.public_user_data;
      const userId = publicUserData.user_id;
      const role = evt.data.role.toLowerCase().replace('org:', ''); // e.g. org:admin -> admin

      // Map Clerk IDs to our internal UUIDs
      const orgData = await sql`SELECT id FROM public.organizations WHERE clerk_org_id = ${organizationId}`;
      const userData = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${userId}`;

      if (orgData.length > 0 && userData.length > 0) {
        const internalOrgId = orgData[0].id;
        const internalUserId = userData[0].id;

        await sql`
          INSERT INTO public.organization_members (organization_id, user_id, role)
          VALUES (${internalOrgId}, ${internalUserId}, ${role})
          ON CONFLICT (organization_id, user_id) DO UPDATE
          SET role = EXCLUDED.role
        `;
        console.log(`Synced membership for user ${userId} in org ${organizationId}`);
      } else {
        console.error(`Failed to sync membership: internal org or user not found. (org=${organizationId}, user=${userId})`);
      }
    }
    else if (eventType === 'organizationMembership.deleted') {
      // NOTE: Clerk provides public_user_data.user_id in deleted event, too.
      const organizationId = evt.data.organization.id;
      const userId = evt.data.public_user_data.user_id;

      const orgData = await sql`SELECT id FROM public.organizations WHERE clerk_org_id = ${organizationId}`;
      const userData = await sql`SELECT id FROM public.users WHERE clerk_user_id = ${userId}`;

      if (orgData.length > 0 && userData.length > 0) {
        await sql`
          DELETE FROM public.organization_members 
          WHERE organization_id = ${orgData[0].id} AND user_id = ${userData[0].id}
        `;
        console.log(`Deleted membership for user ${userId} in org ${organizationId}`);
      }
    }
    else if (eventType === 'user.deleted') {
      await sql`DELETE FROM public.users WHERE clerk_user_id = ${id}`;
    }
    else if (eventType === 'organization.deleted') {
      await sql`DELETE FROM public.organizations WHERE clerk_org_id = ${id}`;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error(`Error processing webhook ${eventType}:`, err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

import { sql } from "./db.mjs";

let schemaEnsured = false;
let schemaEnsurePromise: Promise<void> | null = null;

const NOTIFICATION_SCHEMA_MARKER_KEY = "notification_schema_v1";

async function ensureSchemaMarkersTable() {
  const tableExists = await sql`
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'runtime_schema_markers'
  `;
  if (tableExists.length > 0) return;

  await sql`
    CREATE TABLE IF NOT EXISTS public.runtime_schema_markers (
      key text PRIMARY KEY,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function hasNotificationSchemaMarker() {
  await ensureSchemaMarkersTable();
  const rows = await sql<{ key: string }[]>`
    SELECT key
    FROM public.runtime_schema_markers
    WHERE key = ${NOTIFICATION_SCHEMA_MARKER_KEY}
    LIMIT 1
  `;

  return rows.length > 0;
}

async function writeNotificationSchemaMarker() {
  await ensureSchemaMarkersTable();
  await sql`
    INSERT INTO public.runtime_schema_markers (key, updated_at)
    VALUES (${NOTIFICATION_SCHEMA_MARKER_KEY}, now())
    ON CONFLICT (key) DO UPDATE
    SET updated_at = EXCLUDED.updated_at
  `;
}

export async function ensureNotificationsSchema() {
  if (schemaEnsured) return;
  if (schemaEnsurePromise) {
    await schemaEnsurePromise;
    return;
  }

  schemaEnsurePromise = (async () => {
    if (await hasNotificationSchemaMarker()) {
      schemaEnsured = true;
      return;
    }

    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    await sql`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
        title text NOT NULL,
        message text NOT NULL,
        type text NOT NULL DEFAULT 'info',
        link text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public.notification_dismissals (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        dismissed_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(notification_id, user_id)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_org_time
      ON public.notifications (organization_id, created_at DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user
      ON public.notification_dismissals (user_id)
    `;

    await writeNotificationSchemaMarker();
    schemaEnsured = true;
  })();

  try {
    await schemaEnsurePromise;
  } finally {
    schemaEnsurePromise = null;
  }
}

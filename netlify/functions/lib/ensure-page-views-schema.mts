import { sql } from "./db.mjs";

let schemaEnsured = false;
let schemaEnsurePromise: Promise<void> | null = null;

const PAGE_VIEWS_SCHEMA_MARKER_KEY = "page_views_schema_v1";

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

async function hasPageViewsSchemaMarker() {
  await ensureSchemaMarkersTable();
  const rows = await sql<{ key: string }[]>`
    SELECT key
    FROM public.runtime_schema_markers
    WHERE key = ${PAGE_VIEWS_SCHEMA_MARKER_KEY}
    LIMIT 1
  `;

  return rows.length > 0;
}

async function writePageViewsSchemaMarker() {
  await ensureSchemaMarkersTable();
  await sql`
    INSERT INTO public.runtime_schema_markers (key, updated_at)
    VALUES (${PAGE_VIEWS_SCHEMA_MARKER_KEY}, now())
    ON CONFLICT (key) DO UPDATE
    SET updated_at = EXCLUDED.updated_at
  `;
}

export async function ensurePageViewsSchema() {
  if (schemaEnsured) return;
  if (schemaEnsurePromise) {
    await schemaEnsurePromise;
    return;
  }

  schemaEnsurePromise = (async () => {
    if (await hasPageViewsSchemaMarker()) {
      schemaEnsured = true;
      return;
    }

    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    await sql`
      CREATE TABLE IF NOT EXISTS public.page_views (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
        path text NOT NULL DEFAULT '/',
        last_active_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_page_views_user_org
      ON public.page_views (user_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_page_views_last_active_at
      ON public.page_views (last_active_at)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_page_views_org_last_active
      ON public.page_views (organization_id, last_active_at)
    `;

    await writePageViewsSchemaMarker();
    schemaEnsured = true;
  })();

  try {
    await schemaEnsurePromise;
  } finally {
    schemaEnsurePromise = null;
  }
}

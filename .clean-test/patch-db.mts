import dotenv from 'dotenv';
dotenv.config();
import { sql } from '../netlify/functions/lib/db.mjs';

async function patch() {
  await sql`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS clerk_user_id text UNIQUE;`;
  await sql`ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS clerk_org_id text UNIQUE;`;
  console.log('Patched columns');
  process.exit(0);
}
patch().catch(e => {
  console.error(e);
  process.exit(1);
});

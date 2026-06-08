import { sql } from './db.mjs';

let schemaEnsured = false;

export async function ensureOnboardingRemindersSchema() {
  if (schemaEnsured) return;

  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'onboarding_reminder_email_sent_at'
  `;
  if (cols.length > 0) {
    schemaEnsured = true;
    return;
  }

  await sql`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS onboarding_reminder_email_sent_at timestamptz
  `;

  schemaEnsured = true;
}

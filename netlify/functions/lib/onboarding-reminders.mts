import { sql } from './db.mjs';
import { sendEmail } from './email.mjs';
import { onboardingReminderTemplate } from './onboarding-email-templates.mjs';
import { ensureOnboardingRemindersSchema } from './ensure-onboarding-reminders-schema.mjs';
import { ensureOnboardingSchema } from './ensure-onboarding-schema.mjs';

const baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://dockerdash.app').replace(/\/$/, '');

export const onboardingJsonHeaders = () => {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
};

export async function sendDueOnboardingReminders() {
  await ensureOnboardingSchema();
  await ensureOnboardingRemindersSchema();

  // Find users created between 48 and 96 hours ago
  // who haven't been sent a reminder yet.
  // We also check that they do NOT belong to any organization
  // that has onboarding_status = 'completed' or 'skipped'.
  const candidates = await sql`
    SELECT
      u.id,
      u.email,
      u.full_name
    FROM public.users u
    WHERE u.created_at < now() - interval '2 days'
      AND u.created_at >= now() - interval '4 days'
      AND u.onboarding_reminder_email_sent_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id
        WHERE om.user_id = u.id
          AND o.onboarding_status IN ('completed', 'skipped')
      )
  `;

  let sent = 0;
  const errors: string[] = [];

  for (const user of candidates) {
    try {
      const template = onboardingReminderTemplate({
        name: user.full_name,
        dashboardUrl: \`\${baseUrl}/\`,
      });

      const res = await sendEmail({
        to: user.email,
        subject: template.subject,
        text: template.body,
        html: template.html,
      });

      if (!res.success) {
        throw new Error(res.error || "Unknown email delivery error");
      }

      await sql`
        UPDATE public.users
        SET onboarding_reminder_email_sent_at = now(),
            updated_at = now()
        WHERE id = \${user.id}
      `;

      sent++;
    } catch (e: any) {
      console.error(\`Failed to send onboarding reminder to user \${user.id}:\`, e);
      errors.push(\`User \${user.id}: \${e.message}\`);
    }
  }

  return { scanned: candidates.length, sent, errors: errors.length > 0 ? errors : undefined };
}

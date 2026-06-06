import type { Config } from '@netlify/functions';

const HEADERS = { 'Content-Type': 'application/json' };

export default async () => {
  const expectedSecret = (process.env.DONOR_REMINDER_CRON_SECRET || '').trim();
  const baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '');

  if (!expectedSecret) {
    // Fail-closed when DONOR_REMINDER_CRON_SECRET is unset
    return new Response(
      JSON.stringify({ error: 'DONOR_REMINDER_CRON_SECRET is not configured - function disabled' }),
      { status: 404, headers: HEADERS },
    );
  }
  if (!baseUrl) {
    return new Response(
      JSON.stringify({ error: 'DEPLOY_PRIME_URL is not configured' }),
      { status: 503, headers: HEADERS },
    );
  }

  const target = `${baseUrl}/api/donor-reminders`;
  try {
    const resp = await fetch(target, {
      method: 'POST',
      headers: {
        'x-cron-secret': expectedSecret,
        'content-type': 'application/json',
      },
    });
    const body = await resp.text();
    return new Response(body, { status: resp.status, headers: HEADERS });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Failed to invoke donor-reminders: ${err?.message || 'unknown'}` }),
      { status: 502, headers: HEADERS },
    );
  }
};

export const config: Config = {
  // Internal wrapper — no public path. Invoked only via netlify.toml [[scheduled]].
  schedule: '@never',
};

export interface OnboardingEmailTemplateInput {
  name?: string | null;
  dashboardUrl: string;
}

// ── Design tokens ────────────────────────────────────────────────────────────
const COLOR = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  headerBg: "#0F172A",
  headerAccent: "#3B82F6",
  accent: "#6366F1",
  accentDark: "#4F46E5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  pillBg: "#EEF2FF",
  pillText: "#4F46E5",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function badge(text: string, bg: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${text}</span>`;
}

function ctaButton(text: string, href: string): string {
  return `
    <a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,${COLOR.accent},${COLOR.accentDark});color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
      ${text}
    </a>`;
}

function shell({
  header,
  body,
  footer,
}: {
  header: string;
  body: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Dockerdash</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bg};min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- ── Logo bar ── -->
          <tr>
            <td style="padding:0 0 20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:8px;">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="28" height="28" rx="7" fill="${COLOR.accent}"/>
                        <path d="M8 14h12M14 8v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
                      </svg>
                      <span style="color:${COLOR.textPrimary};font-size:16px;font-weight:700;letter-spacing:-0.02em;">Dockerdash</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="color:${COLOR.textMuted};font-size:12px;">dockerdash.app</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Card ── -->
          <tr>
            <td style="background:${COLOR.card};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1),0 8px 24px rgba(0,0,0,0.06);">

              <!-- Header band -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${COLOR.headerBg};padding:28px 32px 32px;">
                    ${header}
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px;">
                    ${body}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:24px 8px 0;">
              <p style="margin:0;color:${COLOR.textMuted};font-size:12px;line-height:1.7;text-align:center;">
                ${
                  footer
                    ? footer
                    : `You're receiving this because you signed up for <a href="https://dockerdash.app" style="color:${COLOR.accent};text-decoration:none;">dockerdash.app</a>.<br>
                  Questions? Reply to this email — we're here to help.`
                }
              </p>
              <p style="margin:12px 0 0;color:${COLOR.textMuted};font-size:11px;text-align:center;">
                &copy; ${new Date().getFullYear()} Dockerdash &nbsp;·&nbsp; All rights reserved
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function onboardingReminderTemplate(input: OnboardingEmailTemplateInput) {
  const subject = "Complete your Dockerdash setup";
  const greeting = input.name ? `Hi ${input.name.split(" ")[0]},` : "Hi there,";

  const body = [
    `${greeting}`,
    "",
    "We noticed you signed up for Dockerdash a couple of days ago but haven't added your first Docker host yet.",
    "",
    "Connecting your first host only takes a minute, and unlocks real-time monitoring and easy container management.",
    "",
    "Click the button below to go to your dashboard and add a host:",
    "",
    input.dashboardUrl,
    "",
    "Need help? Just reply to this email.",
    "",
    "– The Dockerdash Team",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = shell({
    header: `
      <div style="margin-bottom:16px;">${badge("Getting Started", COLOR.accent, "#fff")}</div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">
        Ready to monitor your containers?
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
        Finish setting up Dockerdash to get started.
      </p>
    `,
    body: `
      <p style="margin:0 0 24px;color:${COLOR.textPrimary};font-size:15px;line-height:1.7;">
        ${greeting}<br><br>
        We noticed you signed up for Dockerdash recently but haven't added your first Docker host yet.
      </p>

      <div style="background:${COLOR.pillBg};border:1px solid #C7D2FE;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:${COLOR.pillText};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Next Steps</p>
        <p style="margin:0 0 16px;color:${COLOR.textPrimary};font-size:14px;line-height:1.6;">
          Connecting a host is easy and gives you instant visibility into your containers, real-time logs, and metrics.
        </p>
        ${ctaButton("Add your first Host", input.dashboardUrl)}
      </div>

      <p style="margin:0;color:${COLOR.textSecondary};font-size:13px;line-height:1.7;">
        If you run into any issues or have questions, just reply to this email. We're happy to help!
      </p>
    `,
  });

  return { subject, body, html };
}

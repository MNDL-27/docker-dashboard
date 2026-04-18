export interface DonorEmailTemplateInput {
  name?: string | null;
  orgName: string;
  expiresAt: string;
  transactionId?: string | null;
  daysLeft?: number;
  referenceToken?: string;
  reason?: string;
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
  successPillBg: "#D1FAE5",
  successPillText: "#065F46",
  warningPillBg: "#FEF3C7",
  warningPillText: "#92400E",
  dangerPillBg: "#FEE2E2",
  dangerPillText: "#991B1B",
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function infoRow(label: string, value: string, isMono = false): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${COLOR.border};width:40%;color:${COLOR.textSecondary};font-size:13px;font-weight:500;letter-spacing:0.02em;vertical-align:middle;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${COLOR.border};color:${COLOR.textPrimary};font-size:13px;font-weight:600;${isMono ? `font-family:ui-monospace,'Cascadia Code','Fira Code',monospace;letter-spacing:0.05em;` : ""}vertical-align:middle;">${value}</td>
    </tr>`;
}

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
                    : `You're receiving this because you have an account on <a href="https://dockerdash.app" style="color:${COLOR.accent};text-decoration:none;">dockerdash.app</a>.<br>
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

export function donorActivationTemplate(input: DonorEmailTemplateInput) {
  const subject = "Your Dockerdash donor premium is now active";
  const greeting = input.name ? `Hi ${input.name.split(" ")[0]},` : "Hi there,";
  const expiry = formatDate(input.expiresAt);

  const body = [
    `${greeting}`,
    "",
    `Thank you for supporting Dockerdash! Your donation has been received and donor premium is now active for "${input.orgName}".`,
    "",
    `Premium access is valid until ${expiry}.`,
    input.transactionId ? `Transaction ID: ${input.transactionId}` : null,
    "",
    "What's included in donor premium:",
    "  • Advanced alert rules",
    "  • Priority support",
    "  • All pro features",
    "",
    "Need a manual receipt or invoice? Just reply to this email.",
    "",
    "– The Dockerdash Team",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = shell({
    header: `
      <div style="margin-bottom:16px;">${badge("Donor Premium", "#10B981", "#fff")}</div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">
        You're supporting Dockerdash!
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
        Donor premium access is now active for <strong style="color:rgba(255,255,255,0.9);">${input.orgName}</strong>.
      </p>
    `,
    body: `
      <!-- Greeting -->
      <p style="margin:0 0 24px;color:${COLOR.textPrimary};font-size:15px;line-height:1.7;">
        ${greeting}<br><br>
        Thank you for supporting Dockerdash. Your donation helps keep the project alive and growing. As a thank-you, your organization now has full premium access.
      </p>

      <!-- Details card -->
      <div style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:${COLOR.textSecondary};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Access Details</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Organization", input.orgName)}
          ${infoRow("Status", `<span style="color:${COLOR.success};font-weight:700;">&#x2713;&nbsp; Active</span>`)}
          ${infoRow("Valid until", `<strong>${expiry}</strong>`)}
          ${input.transactionId ? infoRow("Transaction ID", input.transactionId, true) : ""}
        </table>
      </div>

      <!-- Feature highlights -->
      <div style="background:${COLOR.pillBg};border:1px solid #C7D2FE;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:${COLOR.pillText};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">What's included</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;color:${COLOR.textPrimary};font-size:13px;">
              <span style="color:${COLOR.accent};margin-right:8px;font-weight:700;">&#x2714;</span> Advanced alert rules & notifications
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:${COLOR.textPrimary};font-size:13px;">
              <span style="color:${COLOR.accent};margin-right:8px;font-weight:700;">&#x2714;</span> All Pro dashboard features
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:${COLOR.textPrimary};font-size:13px;">
              <span style="color:${COLOR.accent};margin-right:8px;font-weight:700;">&#x2714;</span> Priority email support
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0;color:${COLOR.textSecondary};font-size:13px;line-height:1.7;">
        Need a manual invoice or receipt? Just reply to this email and we'll sort it out.
      </p>
    `,
  });

  return { subject, body, html };
}

export function donorRenewalReminderTemplate(input: DonorEmailTemplateInput) {
  const subject = `Your donor premium expires in ${input.daysLeft ?? 0} day${(input.daysLeft ?? 0) === 1 ? "" : "s"}`;
  const greeting = input.name ? `Hi ${input.name.split(" ")[0]},` : "Hi there,";
  const expiry = formatDate(input.expiresAt);
  const isUrgent = (input.daysLeft ?? 7) <= 1;

  const body = [
    `${greeting}`,
    "",
    `This is a reminder that donor premium for "${input.orgName}" expires on ${expiry} (${input.daysLeft ?? 0} day${(input.daysLeft ?? 0) === 1 ? "" : "s"} remaining).`,
    input.referenceToken
      ? `To renew, include your reference token ${input.referenceToken} in your next donation note.`
      : "To renew, make a donation and include your organization name in the note.",
    "",
    "If you've already donated, reply with your transaction ID and we'll activate it right away.",
    "",
    "– The Dockerdash Team",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const urgencyColor = isUrgent ? COLOR.danger : COLOR.warning;
  const urgencyBg = isUrgent ? COLOR.dangerPillBg : COLOR.warningPillBg;
  const urgencyText = isUrgent ? COLOR.dangerPillText : COLOR.warningPillText;

  const html = shell({
    header: `
      <div style="margin-bottom:16px;">${badge(`Expires in ${input.daysLeft ?? 0} day${(input.daysLeft ?? 0) === 1 ? "" : "s"}`, urgencyColor, "#fff")}</div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">
        Renew your donor premium
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
        Premium access for <strong style="color:rgba(255,255,255,0.9);">${input.orgName}</strong> is expiring soon.
      </p>
    `,
    body: `
      <p style="margin:0 0 24px;color:${COLOR.textPrimary};font-size:15px;line-height:1.7;">
        ${greeting}<br><br>
        Your donor premium is expiring soon. Renew by making a donation to keep your access to advanced features.
      </p>

      <!-- Expiry alert -->
      <div style="background:${urgencyBg};border:1px solid ${urgencyColor}33;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Organization", input.orgName)}
          ${infoRow("Expires on", `<strong style="color:${urgencyColor};">${expiry}</strong>`)}
          ${infoRow("Time remaining", `<strong style="color:${urgencyColor};">${input.daysLeft ?? 0} day${(input.daysLeft ?? 0) === 1 ? "" : "s"}</strong>`)}
          ${input.referenceToken ? infoRow("Renewal token", input.referenceToken, true) : ""}
        </table>
      </div>

      <!-- How to renew -->
      <div style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:${COLOR.textSecondary};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">How to renew</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">1.</strong>&nbsp; Make a donation via Liberapay or PayPal
          </td></tr>
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">2.</strong>&nbsp; Include ${input.referenceToken ? `<code style="background:#E2E8F0;padding:1px 6px;border-radius:4px;font-size:12px;">${input.referenceToken}</code>` : "your org name"} in the payment note
          </td></tr>
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">3.</strong>&nbsp; Premium is activated automatically within minutes
          </td></tr>
        </table>
      </div>

      <p style="margin:0;color:${COLOR.textSecondary};font-size:13px;line-height:1.7;">
        Already donated? Reply to this email with your transaction ID and we'll activate it manually right away.
      </p>
    `,
    footer: `Already renewed? No action needed — we'll activate it automatically.<br>
      Questions? Reply to this email — we're here to help.`,
  });

  return { subject, body, html };
}

export function donorRevokedTemplate(input: DonorEmailTemplateInput) {
  const subject = `Donor premium update for ${input.orgName}`;
  const greeting = input.name ? `Hi ${input.name.split(" ")[0]},` : "Hi there,";

  const body = [
    `${greeting}`,
    "",
    `Donor premium access for "${input.orgName}" is no longer active.`,
    input.reason ? `Reason: ${input.reason}` : null,
    "",
    "You can donate again and include your DNR token to restore access.",
    "",
    "– The Dockerdash Team",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = shell({
    header: `
      <div style="margin-bottom:16px;">${badge("Access Update", COLOR.danger, "#fff")}</div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">
        Donor premium inactive
      </h1>
      <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
        Premium access for <strong style="color:rgba(255,255,255,0.9);">${input.orgName}</strong> is no longer active.
      </p>
    `,
    body: `
      <p style="margin:0 0 24px;color:${COLOR.textPrimary};font-size:15px;line-height:1.7;">
        ${greeting}<br><br>
        Donor premium access for your organization has been deactivated.
      </p>

      ${
        input.reason
          ? `<div style="background:${COLOR.dangerPillBg};border:1px solid ${COLOR.danger}33;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;color:${COLOR.dangerPillText};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Reason</p>
          <p style="margin:0;color:${COLOR.textPrimary};font-size:14px;line-height:1.6;">${input.reason}</p>
        </div>`
          : ""
      }

      <div style="background:${COLOR.bg};border:1px solid ${COLOR.border};border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;color:${COLOR.textSecondary};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Restore access</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">1.</strong>&nbsp; Make a new donation via Liberapay or PayPal
          </td></tr>
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">2.</strong>&nbsp; Include your DNR token or organization name in the note
          </td></tr>
          <tr><td style="padding:5px 0;color:${COLOR.textPrimary};font-size:13px;line-height:1.6;">
            <strong style="color:${COLOR.accent};">3.</strong>&nbsp; Premium will be re-activated automatically
          </td></tr>
        </table>
      </div>

      <p style="margin:0;color:${COLOR.textSecondary};font-size:13px;line-height:1.7;">
        Questions? Just reply to this email and we'll help you sort it out.
      </p>
    `,
  });

  return { subject, body, html };
}

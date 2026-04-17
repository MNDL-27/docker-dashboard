export interface DonorEmailTemplateInput {
  name?: string | null;
  orgName: string;
  expiresAt: string;
  transactionId?: string | null;
  daysLeft?: number;
  referenceToken?: string;
  reason?: string;
}

function renderHtmlShell(title: string, intro: string, rows: string[], footer?: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#0b1020;padding:32px;color:#e5e7eb;">
    <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#1d4ed8,#0f766e);">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">Dockerdash Donor Premium</div>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;color:#fff;">${title}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${intro}</p>
        <div style="margin:20px 0;padding:16px;border-radius:12px;background:#0f172a;border:1px solid #1f2937;">
          ${rows.map((row) => `<div style="margin:0 0 10px;font-size:14px;line-height:1.6;">${row}</div>`).join("")}
        </div>
        ${footer ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#9ca3af;">${footer}</p>` : ""}
      </div>
    </div>
  </div>`;
}

export function donorActivationTemplate(input: DonorEmailTemplateInput) {
  const subject = "Your donor premium is active — thank you!";
  const body = [
    `Hello ${input.name || "there"},`,
    "",
    `Thanks for your support. Donor premium is now active for \"${input.orgName}\" until ${new Date(input.expiresAt).toLocaleString()}.`,
    input.transactionId ? `Transaction ID: ${input.transactionId}` : null,
    "",
    "Need a manual receipt/invoice? Reply to this email and we'll help.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderHtmlShell(
    "Donor premium activated",
    `Thanks for supporting Dockerdash. Premium access for <strong>${input.orgName}</strong> is now active.`,
    [
      `<strong>Organization:</strong> ${input.orgName}`,
      `<strong>Active until:</strong> ${new Date(input.expiresAt).toLocaleString()}`,
      input.transactionId ? `<strong>Transaction ID:</strong> ${input.transactionId}` : "",
    ].filter(Boolean) as string[],
    "Need a manual invoice or receipt? Just reply to this email.",
  );

  return { subject, body, html };
}

export function donorRenewalReminderTemplate(input: DonorEmailTemplateInput) {
  const subject = `Donor premium expires in ${input.daysLeft ?? 0} day(s)`;
  const body = [
    `Hello ${input.name || "there"},`,
    "",
    `Your donor premium for \"${input.orgName}\" expires on ${new Date(input.expiresAt).toLocaleString()}.`,
    input.referenceToken ? `Use reference token ${input.referenceToken} in your next donation note.` : null,
    "",
    "If you've already donated, reply with your transaction ID for faster verification.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderHtmlShell(
    `Premium expires in ${input.daysLeft ?? 0} day(s)`,
    `Your donor premium for <strong>${input.orgName}</strong> is approaching expiry.`,
    [
      `<strong>Organization:</strong> ${input.orgName}`,
      `<strong>Expires at:</strong> ${new Date(input.expiresAt).toLocaleString()}`,
      input.referenceToken ? `<strong>Reference token:</strong> ${input.referenceToken}` : "",
    ].filter(Boolean) as string[],
    "If you've already donated, reply with your transaction ID for faster verification.",
  );

  return { subject, body, html };
}

export function donorRevokedTemplate(input: DonorEmailTemplateInput) {
  const subject = `Donor premium access update for ${input.orgName}`;
  const body = [
    `Hello ${input.name || "there"},`,
    "",
    `Donor premium access for \"${input.orgName}\" is no longer active.`,
    input.reason ? `Reason: ${input.reason}` : null,
    "",
    "You can donate again and include your DNR token to restore access.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderHtmlShell(
    "Donor premium inactive",
    `Donor premium access for <strong>${input.orgName}</strong> is no longer active.`,
    [input.reason ? `<strong>Reason:</strong> ${input.reason}` : ""].filter(Boolean) as string[],
    "You can donate again and include your DNR token to restore access.",
  );

  return { subject, body, html };
}

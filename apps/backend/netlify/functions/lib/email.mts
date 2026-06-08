export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  provider: string;
  messageId: string | null;
  error: string | null;
}

function provider() {
  return (process.env.EMAIL_PROVIDER || "resend").trim().toLowerCase();
}

function fromAddress() {
  return (process.env.EMAIL_FROM || "Dockerdash <no-reply@dockerdash.app>").trim();
}

function replyToAddress(override?: string) {
  return (override || process.env.EMAIL_REPLY_TO || "").trim() || undefined;
}

async function sendWithResend(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return {
      success: false,
      provider: "resend",
      messageId: null,
      error: "RESEND_API_KEY is not configured",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      reply_to: replyToAddress(payload.replyTo),
    }),
  });

  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    body = { raw };
  }

  if (!response.ok) {
    return {
      success: false,
      provider: "resend",
      messageId: null,
      error: typeof body.message === "string" ? body.message : `Resend request failed (${response.status})`,
    };
  }

  return {
    success: true,
    provider: "resend",
    messageId: typeof body.id === "string" ? body.id : null,
    error: null,
  };
}

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const mode = provider();

  if (mode === "resend") {
    return sendWithResend(payload);
  }

  return {
    success: false,
    provider: mode,
    messageId: null,
    error: `Unsupported EMAIL_PROVIDER: ${mode}`,
  };
}

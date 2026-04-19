function trimDiagnostic(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function summarizeHtmlDiagnostic(rawDetails: string) {
  const titleMatch = rawDetails.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim()) : null;
  const isCloudflare = /cloudflare/i.test(rawDetails);

  if (title && isCloudflare) {
    return trimDiagnostic(`Cloudflare HTML error page: ${title}`);
  }

  if (title) {
    return trimDiagnostic(`HTML error page: ${title}`);
  }

  if (isCloudflare) {
    return "Cloudflare returned an HTML error page.";
  }

  return "The upstream service returned an HTML error page.";
}

export function summarizeDiagnosticText(rawDetails: string) {
  const normalized = rawDetails.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (/<(?:!doctype|html|head|body)\b/i.test(rawDetails)) {
    return summarizeHtmlDiagnostic(rawDetails);
  }

  return trimDiagnostic(normalized);
}

export function parseDiagnosticPayload(rawDetails: string) {
  try {
    return JSON.parse(rawDetails);
  } catch {
    return summarizeDiagnosticText(rawDetails);
  }
}

export function formatDiagnosticDetail(details: unknown) {
  if (details === null || details === undefined) {
    return null;
  }

  if (typeof details === "string") {
    return summarizeDiagnosticText(details);
  }

  if (typeof details === "object") {
    const error =
      typeof (details as { error?: unknown }).error === "string"
        ? summarizeDiagnosticText((details as { error: string }).error)
        : null;

    if (error) {
      return error;
    }

    try {
      return trimDiagnostic(JSON.stringify(details));
    } catch {
      return "Upstream error details were unavailable.";
    }
  }

  return String(details);
}

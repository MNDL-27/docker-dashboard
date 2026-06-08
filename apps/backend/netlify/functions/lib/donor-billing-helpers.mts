export function extractDnr8Token(text: string | null | undefined): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();
  const match = upper.match(/DNR-[A-Z0-9]{8}/);
  if (!match) return null;
  return /^DNR-[A-Z0-9]{8}$/.test(match[0]) ? match[0] : null;
}

export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function coerceString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

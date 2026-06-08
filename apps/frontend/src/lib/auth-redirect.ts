export function getSafeNextPath(rawValue: string | null | undefined, fallback = "/app") {
  if (!rawValue) {
    return fallback;
  }

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback;
  }

  return rawValue;
}

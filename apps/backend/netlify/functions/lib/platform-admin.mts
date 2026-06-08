export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const configuredEmails = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(email.toLowerCase());
}

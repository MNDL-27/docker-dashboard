const ADMIN_EMAILS = [
  'protikmndl27@gmail.com',
  'protikmondal27@gmail.com',
];

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

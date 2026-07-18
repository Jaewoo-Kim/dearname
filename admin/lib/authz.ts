export function getAllowlist(): string[] {
  return (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = getAllowlist();
  return allowlist.length === 0 || allowlist.includes(email.toLowerCase());
}

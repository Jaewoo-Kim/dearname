// 개인정보 마스킹 + 표시용 포맷 헬퍼 (admin_site_plan.md 6장 보안 체크리스트)

export function maskName(name?: string | null): string {
  if (!name) return '-';
  const chars = Array.from(name);
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return `${chars[0]}○`;
  return chars.map((c, i) => (i === 0 || i === chars.length - 1 ? c : '○')).join('');
}

export function maskContact(contact?: string | null): string {
  if (!contact) return '-';
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@');
    if (!domain) return contact;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
  }
  const digits = contact.replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return contact;
}

export function formatKRW(amount?: number | null): string {
  if (amount == null) return '-';
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  refunded: '환불됨',
  failed: '실패',
};

export const PRODUCT_LABEL: Record<string, string> = {
  premium: '프리미엄',
  self: '셀프분석',
};
